import type Anthropic from "@anthropic-ai/sdk";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { agentRuns, inboundItems, people } from "../db/schema";
import { config } from "../lib/config";
import type { LlmClient } from "../llm/client";
import { costUsd } from "../llm/pricing";
import { PM_SYSTEM } from "./prompts";
import { isToolName, toAnthropicTools, TOOLS, type ToolCtx } from "./tools";
import type { Triage } from "./triage";

export const MAX_STEPS = 8;

type ToolCall = { tool: string; input: unknown; result?: unknown };

type Step = {
  // Every tool call the model made in this turn, in order (it can make several at once).
  calls?: ToolCall[];
  text?: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
};

export type PmOutcome = { outcome: "handled" | "needs_call"; reason?: string };

export async function runPmAgent(
  llm: LlmClient,
  ctx: ToolCtx,
  triage: Triage,
  opts: { replayed?: boolean; programInfo?: string } = {},
): Promise<PmOutcome> {
  const { db, workspaceId, inboundItemId } = ctx;
  const [item] = await db
    .select()
    .from(inboundItems)
    .where(and(eq(inboundItems.id, inboundItemId), eq(inboundItems.workspaceId, workspaceId)));
  if (!item) throw new Error(`inbound item ${inboundItemId} is not in this workspace`);
  const [sender] = item.fromPersonId ? await db.select().from(people).where(eq(people.id, item.fromPersonId)) : [];

  const model = config.models.agent;
  const tools = toAnthropicTools();
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        `New ${item.kind} from ${sender ? `${sender.name} (${sender.role}, id ${sender.id})` : "unknown sender"}.\n` +
        `Subject: ${item.subject}\n\n${item.body}\n\n` +
        `Triage: ${JSON.stringify(triage)}` +
        (opts.programInfo ? `\n\nProgram records relevant to this item:\n${opts.programInfo}` : ""),
    },
  ];
  const steps: Step[] = [];
  let outcome: PmOutcome | null = null;

  try {
    for (let i = 0; i < MAX_STEPS && !outcome; i++) {
      const started = Date.now();
      const res = await llm.create({
        model,
        max_tokens: 4096,
        system: PM_SYSTEM,
        tools,
        messages,
      });
      const step: Step = {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
        latencyMs: Date.now() - started,
      };
      steps.push(step);

      if (res.stop_reason === "refusal") {
        outcome = {
          outcome: "needs_call",
          reason: "the model declined this item",
        };
        break;
      }
      const calls = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (calls.length === 0) {
        step.text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        outcome = { outcome: "handled" };
        break;
      }

      const results: Anthropic.ToolResultBlockParam[] = [];
      step.calls = [];
      for (const call of calls) {
        const record: ToolCall = { tool: call.name, input: call.input };
        step.calls.push(record);
        if (!isToolName(call.name)) {
          outcome = {
            outcome: "needs_call",
            reason: `unknown tool requested: ${call.name}`,
          };
          break;
        }
        const parsed = TOOLS[call.name].input.safeParse(call.input);
        if (!parsed.success) {
          outcome = {
            outcome: "needs_call",
            reason: `invalid input for ${call.name}`,
          };
          break;
        }
        try {
          const result = await (TOOLS[call.name].run as (c: ToolCtx, input: unknown) => Promise<unknown>)(
            ctx,
            parsed.data,
          );
          record.result = result;
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(result ?? null),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          record.result = { error: message };
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: message,
            is_error: true,
          });
        }
        if (call.name === "escalate") {
          outcome = {
            outcome: "needs_call",
            reason: (parsed.data as { reason: string }).reason,
          };
          break;
        }
      }
      if (!outcome) {
        messages.push({ role: "assistant", content: res.content }, { role: "user", content: results });
      }
    }

    outcome ??= { outcome: "needs_call", reason: "step limit" };
  } finally {
    // Written even when a call throws, so spent tokens always count toward the spend cap.
    await recordRun(steps);
  }
  return outcome;

  async function recordRun(steps: Step[]) {
    const inputTokens = steps.reduce((s, x) => s + x.inputTokens, 0);
    const outputTokens = steps.reduce((s, x) => s + x.outputTokens, 0);
    await db.insert(agentRuns).values({
      id: `${workspaceId}:run:${randomUUID()}`,
      workspaceId,
      agent: "pm",
      inboundItemId,
      model,
      inputTokens,
      outputTokens,
      costUsd: opts.replayed
        ? 0
        : costUsd(model, {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
          }),
      latencyMs: steps.reduce((s, x) => s + x.latencyMs, 0),
      replayed: opts.replayed ?? false,
      steps,
    });
  }
}
