// Debug helper: run chosen tuned policy items and print what Ada did. Usage: tsx scripts/eval-debug.ts p01 p17
import { eq } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { handleInbound } from "../src/agent/handleInbound";
import { makePgliteDb } from "../src/db/client";
import { agentRuns, drafts, inboundItems, people, startups } from "../src/db/schema";
import { anthropicClient } from "../src/llm/client";
import { seedWorkspace } from "../src/seed/seedWorkspace";

async function main() {
  const ids = process.argv.slice(2);
  const items = readFileSync("evals/policy.jsonl", "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const db = await makePgliteDb();
  await seedWorkspace(db, "dbg");
  const live = anthropicClient();
  for (const c of items.filter((i) => ids.includes(i.id))) {
    const [sender] = await db.select().from(people).where(eq(people.name, c.from));
    const id = `dbg:inbound:${c.id}`;
    await db.insert(inboundItems).values({ id, workspaceId: "dbg", simDay: 0, kind: "email", fromPersonId: sender?.id ?? null, subject: c.subject, body: c.body });
    await handleInbound({ db, llm: live, triageLlm: live }, "dbg", id);
    const [item] = await db.select().from(inboundItems).where(eq(inboundItems.id, id));
    const d = await db.select().from(drafts).where(eq(drafts.inboundItemId, id));
    const runs = await db.select().from(agentRuns).where(eq(agentRuns.inboundItemId, id));
    const risks = await db.select({ id: startups.id, r: startups.riskLevel }).from(startups);
    console.log(JSON.stringify({ id: c.id, state: item.state, reason: item.reason, triage: item.triage, drafts: d.map((x) => x.payload), calls: runs.flatMap((r) => (r.steps as { calls?: { tool: string; input: unknown }[]; text?: string }[]).map((s) => s.calls?.map((x) => x.tool) ?? s.text)), risks: risks.filter((x) => x.r > 0) }, null, 1));
  }
}
main();
