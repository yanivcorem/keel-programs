import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client";
import { inboundItems } from "../db/schema";
import type { LlmClient } from "../llm/client";
import { runPmAgent } from "./pm";
import { TOOLS, type ToolCtx } from "./tools";
import { triage } from "./triage";

export type HandleDeps = {
  db: Db;
  llm: LlmClient;
  triageLlm: LlmClient;
  replayed?: boolean;
  // Program records relevant to this item (session details, the perks page, RSVPs). Today only the
  // held-out eval passes these; a knowledge-base lookup will supply them in the product later.
  programInfo?: string;
};

export async function handleInbound(deps: HandleDeps, workspaceId: string, inboundItemId: string): Promise<void> {
  const ctx: ToolCtx = { db: deps.db, workspaceId, inboundItemId };
  const opts = { replayed: deps.replayed, programInfo: deps.programInfo };
  const where = and(eq(inboundItems.id, inboundItemId), eq(inboundItems.workspaceId, workspaceId));

  const t = await triage(deps.triageLlm, ctx, opts);
  await deps.db.update(inboundItems).set({ triage: t }).where(where);

  // Escalated items still get a short pass from Ada (flag at-risk, safety acknowledgment), with no
  // drafting tools. Whatever happens there, the item ends in "Needs your call".
  if (t.escalate) {
    let reason = t.reason;
    try {
      const pass = await runPmAgent(deps.llm, ctx, t, { ...opts, mode: "escalation" });
      reason = pass.reason ?? t.reason;
    } catch (err) {
      // The hand-over matters more than the extra pass: escalate on triage's reason.
      console.error("escalation pass failed", err);
    }
    const [current] = await deps.db.select().from(inboundItems).where(where);
    if (current?.state !== "needs_call") await TOOLS.escalate.run(ctx, { reason });
    return;
  }

  const result = await runPmAgent(deps.llm, ctx, t, opts);

  await deps.db
    .update(inboundItems)
    .set(
      result.outcome === "handled"
        ? { state: "handled" }
        : { state: "needs_call", reason: result.reason ?? "needs your call" },
    )
    .where(where);
}
