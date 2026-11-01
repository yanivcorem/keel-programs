import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { agentRuns, inboundItems, people, startups } from "../db/schema";
import { config } from "../lib/config";
import type { LlmClient } from "../llm/client";
import { costUsd } from "../llm/pricing";
import { TRIAGE_SYSTEM } from "./prompts";
import type { ToolCtx } from "./tools";

const TriageSchema = z.object({
  category: z.enum(["mentor_feedback", "participant_request", "event", "other"]),
  startupId: z.string().nullable(),
  escalate: z.boolean(),
  reason: z.string(),
});

export type Triage = z.infer<typeof TriageSchema>;

const UNCLASSIFIED: Triage = { category: "other", startupId: null, escalate: true, reason: "could not classify" };

function parse(textOut: string): Triage | null {
  const match = textOut.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = TriageSchema.safeParse(JSON.parse(match[0]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function triage(llm: LlmClient, ctx: ToolCtx, opts: { replayed?: boolean } = {}): Promise<Triage> {
  const { db, workspaceId, inboundItemId } = ctx;
  const [item] = await db
    .select()
    .from(inboundItems)
    .where(and(eq(inboundItems.id, inboundItemId), eq(inboundItems.workspaceId, workspaceId)));
  if (!item) throw new Error(`inbound item ${inboundItemId} is not in this workspace`);

  const [sender] = item.fromPersonId
    ? await db
        .select()
        .from(people)
        .where(and(eq(people.id, item.fromPersonId), eq(people.workspaceId, workspaceId)))
    : [];
  const cohort = await db
    .select({ id: startups.id, name: startups.name })
    .from(startups)
    .where(eq(startups.workspaceId, workspaceId));

  const model = config.models.triage;
  const started = Date.now();
  const res = await llm.create({
    model,
    max_tokens: 1024,
    system: TRIAGE_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          `Startups: ${JSON.stringify(cohort)}\n\n` +
          `From: ${sender ? `${sender.name} (${[sender.role, sender.startupId].filter(Boolean).join(", ")})` : "unknown"}\n` +
          `Subject: ${item.subject}\n\n${item.body}`,
      },
    ],
  });
  const latencyMs = Date.now() - started;

  const textOut = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let result = res.stop_reason === "refusal" ? UNCLASSIFIED : (parse(textOut) ?? UNCLASSIFIED);
  if (result.startupId && !cohort.some((s) => s.id === result.startupId)) {
    result = { ...result, startupId: null };
  }

  await db.insert(agentRuns).values({
    id: `${workspaceId}:run:${randomUUID()}`,
    workspaceId,
    agent: "triage",
    inboundItemId,
    model,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUsd: opts.replayed ? 0 : costUsd(model, res.usage),
    latencyMs,
    replayed: opts.replayed ?? false,
    steps: [{ output: result }],
  });
  return result;
}
