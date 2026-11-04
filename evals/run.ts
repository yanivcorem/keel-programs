// Runs the triage and policy evals against the live Claude API and writes evals/results.md.
// Usage: ANTHROPIC_API_KEY=... npm run eval
import { and, eq } from "drizzle-orm";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { handleInbound } from "../src/agent/handleInbound";
import { triage } from "../src/agent/triage";
import { makePgliteDb, type Db } from "../src/db/client";
import { agentRuns, drafts, inboundItems, people } from "../src/db/schema";
import { anthropicClient, type LlmClient } from "../src/llm/client";
import { STARTUPS } from "../src/seed/cohort";
import { seedWorkspace } from "../src/seed/seedWorkspace";
import { advanceDay } from "../src/sim/sim";

// The answer key uses the program policy's three actions (docs: program policy, Nov 4). Triage only
// decides whether to escalate, so a triage pass needs escalate === (action === "escalate"); telling
// handle from ask_for_context happens later, in Ada's own turn.
type Action = "handle" | "ask_for_context" | "escalate";
type Label = { category: string; startup: string | null; action: Action };
type TriageOut = { category: string; startup: string | null; escalate: boolean };
export type TriageCase = { id: string; from: string; subject: string; body: string; expected: Label };
// Policy items default to escalate. Two carry a ruled action instead (p01 handle, p10 ask_for_context, Nov 4).
export type PolicyCase = { id: string; from: string; subject: string; body: string; expected?: Action };
type PolicyOut = { expected: Action; state: string; draftPurposes: (string | undefined)[] };

// Same mapping as the held-out eval: needs_call is escalate, only ask_for_context drafts is ask, anything else is handle.
export function policyAction(state: string, draftPurposes: (string | undefined)[]): Action {
  if (state === "needs_call") return "escalate";
  if (draftPurposes.length > 0 && draftPurposes.every((p) => p === "ask_for_context")) return "ask_for_context";
  return "handle";
}

// An escalate item must also end with zero drafts: Ada hands it over without writing anything.
const policyPass = (r: PolicyOut) =>
  r.expected === "escalate"
    ? r.state === "needs_call" && r.draftPurposes.length === 0
    : policyAction(r.state, r.draftPurposes) === r.expected;
type Results = {
  triage: { expected: Label; actual: TriageOut }[];
  policy: PolicyOut[];
};
type Tally = { items: number; pass: number };

export function score(results: Results): { triage: Tally; policy: Tally } {
  return {
    triage: {
      items: results.triage.length,
      pass: results.triage.filter(
        (r) =>
          r.actual.category === r.expected.category &&
          r.actual.startup === r.expected.startup &&
          r.actual.escalate === (r.expected.action === "escalate"),
      ).length,
    },
    policy: {
      items: results.policy.length,
      pass: results.policy.filter(policyPass).length,
    },
  };
}

const pct = (t: Tally) => `${t.items ? Math.round((100 * t.pass) / t.items) : 0}%`;

export function renderTable(
  s: { triage: Tally; policy: Tally },
  m: { costPerStartupWeekUsd: number; p50StepLatencyMs: number },
): string {
  return [
    "| Eval | Items | Pass | Pass rate |",
    "|---|---|---|---|",
    `| Triage accuracy | ${s.triage.items} | ${s.triage.pass} | ${pct(s.triage)} |`,
    `| Policy adherence | ${s.policy.items} | ${s.policy.pass} | ${pct(s.policy)} |`,
    "",
    "| Cost per startup per week (USD) | p50 latency per agent step (ms) |",
    "|---|---|",
    `| ${m.costPerStartupWeekUsd.toFixed(4)} | ${Math.round(m.p50StepLatencyMs)} |`,
  ].join("\n");
}

let seq = 0;
async function addItem(db: Db, ws: string, c: { from: string; subject: string; body: string }) {
  const [sender] = await db
    .select()
    .from(people)
    .where(and(eq(people.workspaceId, ws), eq(people.name, c.from)));
  const id = `${ws}:inbound:eval-${++seq}`;
  await db.insert(inboundItems).values({
    id,
    workspaceId: ws,
    simDay: 0,
    kind: "email",
    fromPersonId: sender?.id ?? null,
    subject: c.subject,
    body: c.body,
  });
  return id;
}

export async function evalTriageItem(db: Db, ws: string, llm: LlmClient, c: TriageCase) {
  const id = await addItem(db, ws, c);
  const t = await triage(llm, { db, workspaceId: ws, inboundItemId: id });
  const prefix = `${ws}:startup:`;
  const actual: TriageOut = {
    category: t.category,
    startup: t.startupId?.startsWith(prefix) ? t.startupId.slice(prefix.length) : null,
    escalate: t.escalate,
  };
  return { expected: c.expected, actual };
}

const readJsonl = <T>(file: string): T[] =>
  readFileSync(path.join(process.cwd(), "evals", file), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("set ANTHROPIC_API_KEY first");
  const live = anthropicClient();
  const db = await makePgliteDb();
  await seedWorkspace(db, "eval");

  const results: Results = { triage: [], policy: [] };
  for (const c of readJsonl<TriageCase>("triage.jsonl")) {
    const r = await evalTriageItem(db, "eval", live, c);
    results.triage.push(r);
    const ok =
      r.actual.category === r.expected.category &&
      r.actual.startup === r.expected.startup &&
      r.actual.escalate === (r.expected.action === "escalate");
    if (!ok) console.log(`miss ${c.id}`, r);
  }
  for (const c of readJsonl<PolicyCase>("policy.jsonl")) {
    const id = await addItem(db, "eval", c);
    await handleInbound({ db, llm: live, triageLlm: live }, "eval", id);
    const [item] = await db.select().from(inboundItems).where(eq(inboundItems.id, id));
    const d = await db.select().from(drafts).where(eq(drafts.inboundItemId, id));
    const r: PolicyOut = {
      expected: c.expected ?? "escalate",
      state: item.state,
      draftPurposes: d.map((x) => (x.payload as { purpose?: string }).purpose),
    };
    results.policy.push(r);
    if (!policyPass(r)) console.log(`policy fail ${c.id}`, r.expected, item.state, d.length);
  }

  // One simulated week on a fresh workspace, live, for cost per startup and step latency.
  await seedWorkspace(db, "week");
  for (let i = 0; i < 4; i++) await advanceDay({ db }, "week");
  const runs = await db.select().from(agentRuns).where(eq(agentRuns.workspaceId, "week"));
  const weekCost = runs.reduce((s, r) => s + r.costUsd, 0);
  const stepLatencies = runs.flatMap((r) =>
    r.agent === "pm" ? (r.steps as { latencyMs: number }[]).map((s) => s.latencyMs) : [r.latencyMs],
  );

  const table = renderTable(score(results), {
    costPerStartupWeekUsd: weekCost / STARTUPS.length,
    p50StepLatencyMs: median(stepLatencies),
  });
  const out = `# Eval results\n\nRun ${new Date().toISOString().slice(0, 10)} against the live Claude API.\n\n${table}\n`;
  writeFileSync(path.join(process.cwd(), "evals", "results.md"), out);
  console.log(out);
}

if (process.argv[1]?.endsWith("run.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
