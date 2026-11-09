// Runs every scripted day, then the weekly report, live against the Claude API on a scratch in-memory workspace and saves every
// response to fixtures/recorded-runs.json, which the replay fallback serves when the live demo is capped.
// Usage: ANTHROPIC_API_KEY=... npm run record
import type Anthropic from "@anthropic-ai/sdk";
import { writeFileSync } from "node:fs";
import { handleInbound } from "../src/agent/handleInbound";
import { draftWeeklyReport } from "../src/agent/report";
import { makePgliteDb } from "../src/db/client";
import { inboundItems, people } from "../src/db/schema";
import { anthropicClient, type LlmClient } from "../src/llm/client";
import { SCRIPT } from "../src/seed/script";
import { seedWorkspace } from "../src/seed/seedWorkspace";

const WS = "recording";

function recorder(inner: LlmClient, log: Anthropic.Message[]): LlmClient {
  return {
    async create(req) {
      const res = await inner.create(req);
      log.push(res);
      return res;
    },
  };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("set ANTHROPIC_API_KEY first");
  const db = await makePgliteDb();
  await seedWorkspace(db, WS);
  const everyone = await db.select().from(people);
  const live = anthropicClient();
  const out: Record<string, unknown> = {
    _note: `Recorded live on ${new Date().toISOString().slice(0, 10)} by scripts/record-runs.ts. {ws} is replaced with the visitor's workspace id.`,
  };

  for (const item of SCRIPT) {
    const id = `${WS}:inbound:day-${item.simDay}`;
    const from = everyone.find((p) => p.name === item.fromName);
    await db.insert(inboundItems).values({
      id,
      workspaceId: WS,
      simDay: item.simDay,
      kind: item.kind,
      fromPersonId: from?.id ?? null,
      subject: item.subject,
      body: item.body,
    });
    const triage: Anthropic.Message[] = [];
    const pm: Anthropic.Message[] = [];
    await handleInbound({ db, llm: recorder(live, pm), triageLlm: recorder(live, triage) }, WS, id);
    out[String(item.simDay)] = { triage, pm };
    console.log(`day ${item.simDay}: ${triage.length} triage + ${pm.length} agent responses`);
  }

  // The weekly report over the facts the scripted week produced (no drafts approved).
  const report: Anthropic.Message[] = [];
  await draftWeeklyReport(recorder(live, report), db, WS);
  out.report = report[0];
  console.log("report: recorded");

  const json = JSON.stringify(out, null, 2).replaceAll(`${WS}:`, "{ws}:");
  writeFileSync("fixtures/recorded-runs.json", json + "\n");
  console.log("wrote fixtures/recorded-runs.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
