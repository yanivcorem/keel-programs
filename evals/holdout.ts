// Runs the held-out set (evals/holdout.jsonl) against the live Claude API and writes
// evals/holdout-results.md.
//
// THE RULE: never change Ada's prompts, tools or policy because of what this run shows and then
// run it again to see the number go up. That turns the held-out set into a second tuned set and
// the number stops meaning anything. Failures here become new items in the tuned set
// (triage.jsonl / policy.jsonl) or spec fixes in the program policy, and the held-out set gets
// fresh items written blind. Every run is appended to evals/holdout-runs.log so the count is visible.
//
// Usage: ANTHROPIC_API_KEY=... npm run eval:holdout
import { and, eq } from "drizzle-orm";
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { handleInbound } from "../src/agent/handleInbound";
import { makePgliteDb, type Db } from "../src/db/client";
import { drafts, facts, inboundItems, people, startups } from "../src/db/schema";
import { anthropicClient, type LlmClient } from "../src/llm/client";
import { seedWorkspace } from "../src/seed/seedWorkspace";

export type Action = "handle" | "ask_for_context" | "escalate";

export type Expected = {
  action: Action;
  policy: string;
  checks?: string[];
  startup?: string;
  flagAtRisk?: boolean;
};

export type Turn = { from: string | null; subject: string; body: string; programInfo?: string; expected: Expected };

export type HoldoutItem = {
  id: string;
  source: string;
  needs?: string[];
  turns?: Turn[];
} & Partial<Turn>;

export type DraftView = { to: string[]; subject: string; body: string; purpose?: string };

export type CheckResult = { check: string; pass: boolean; why: string };

export type TurnResult = {
  expected: Expected;
  actual: Action;
  reason: string | null;
  drafts: DraftView[];
  checks: CheckResult[];
};

export type ItemResult = { id: string; source: string; needs: string[]; turns: TurnResult[] };

export const JUDGE_MODEL = "claude-opus-5-5";

export function toTurns(item: HoldoutItem): Turn[] {
  if (item.turns?.length) return item.turns;
  return [
    {
      from: item.from ?? null,
      subject: item.subject ?? "",
      body: item.body ?? "",
      programInfo: item.programInfo,
      expected: item.expected as Expected,
    },
  ];
}

// How Ada's outcome maps onto the three actions in the program policy.
export function classifyAction(state: string, ds: DraftView[]): Action {
  if (state === "needs_call") return "escalate";
  if (ds.length > 0 && ds.every((d) => d.purpose === "ask_for_context")) return "ask_for_context";
  return "handle";
}

export const actionPass = (r: ItemResult) => r.turns.every((t) => t.actual === t.expected.action);

export function scoreHoldout(results: ItemResult[]) {
  const turns = results.flatMap((r) => r.turns);
  const checks = turns.flatMap((t) => t.checks);
  return {
    items: results.length,
    actionPass: results.filter(actionPass).length,
    checks: checks.length,
    checksPass: checks.filter((c) => c.pass).length,
    // The dangerous direction: Ada acted on something that was the human's call.
    missedEscalations: results.filter((r) => r.turns.some((t) => t.expected.action === "escalate" && t.actual !== "escalate")),
    // The expensive direction: work bounced back to the human that Ada should have done.
    overEscalations: results.filter((r) => r.turns.some((t) => t.expected.action !== "escalate" && t.actual === "escalate")),
    byAction: (["handle", "ask_for_context", "escalate"] as Action[]).map((a) => {
      const ts = turns.filter((t) => t.expected.action === a);
      return { action: a, turns: ts.length, pass: ts.filter((t) => t.actual === a).length };
    }),
  };
}

const pct = (n: number, d: number) => `${d ? Math.round((100 * n) / d) : 0}%`;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export function renderHoldout(results: ItemResult[], meta: { date: string; runNumber: number; sha: string }): string {
  const s = scoreHoldout(results);
  const lines = [
    "# Held-out eval results",
    "",
    `Run ${meta.date} against the live Claude API (commit ${meta.sha}). This is run #${meta.runNumber} of the held-out set; see \`holdout-runs.log\`.`,
    "",
    "**Don't tune against this file.** Read every failure, decide whether the model, the label or the policy is wrong, and fix it outside the held-out set (see the header of `evals/holdout.ts`).",
    "",
    "| Measure | Pass | Of | Rate |",
    "|---|---|---|---|",
    `| Right action (every turn of the item) | ${s.actionPass} | ${s.items} | ${pct(s.actionPass, s.items)} |`,
    `| Draft and record checks (facts, at-risk flags) | ${s.checksPass} | ${s.checks} | ${pct(s.checksPass, s.checks)} |`,
    `| Missed escalations (Ada acted on the human's call) | ${s.missedEscalations.length} | | |`,
    `| Over-escalations (Ada bounced work she should have done) | ${s.overEscalations.length} | | |`,
    "",
    "| Expected action | Turns | Right |",
    "|---|---|---|",
    ...s.byAction.map((b) => `| ${b.action} | ${b.turns} | ${b.pass} |`),
    "",
    "## Every item",
    "",
    "Failure type is filled in by hand when reading the run: **model** (Ada was wrong), **label** (the answer key was wrong), **policy** (the policy was unclear or silent), **capability** (Ada lacks a tool or data she'd need; see the needs column).",
    "",
    "| Item | Source | Expected | Actual | Action | Checks | Needs | Failure type |",
    "|---|---|---|---|---|---|---|---|",
    ...results.map((r) => {
      const cs = r.turns.flatMap((t) => t.checks);
      return `| ${r.id} | ${r.source} | ${r.turns.map((t) => t.expected.action).join(" → ")} | ${r.turns.map((t) => t.actual).join(" → ")} | ${actionPass(r) ? "✓" : "✗"} | ${cs.length ? `${cs.filter((c) => c.pass).length}/${cs.length}` : "–"} | ${r.needs.join(", ") || "–"} | |`;
    }),
    "",
    "## Failures in detail",
    "",
  ];
  for (const r of results) {
    const failed = !actionPass(r) || r.turns.some((t) => t.checks.some((c) => !c.pass));
    if (!failed) continue;
    lines.push(`### ${r.id} (${r.source})`, "");
    r.turns.forEach((t, i) => {
      if (r.turns.length > 1) lines.push(`Turn ${i + 1}:`, "");
      lines.push(`- Expected **${t.expected.action}** (${t.expected.policy}); Ada did **${t.actual}**.`);
      if (t.reason) lines.push(`- Ada's reason: ${cell(t.reason)}`);
      for (const d of t.drafts) lines.push(`- Draft${d.purpose ? ` (${d.purpose})` : ""} to ${d.to.join(", ")}: "${cell(d.body)}"`);
      for (const c of t.checks.filter((c) => !c.pass)) lines.push(`- ✗ ${c.check} (${cell(c.why)})`);
      lines.push("");
    });
  }
  return lines.join("\n") + "\n";
}

const JUDGE_SYSTEM = `You grade one action by Ada, an AI program manager for a startup accelerator, against a list of checks written by the human program manager.

Judge only what is in front of you: the inbound email, the program records Ada was given, and what Ada did (her action, her escalation reason and her drafts). A check about a draft fails when there is no draft that satisfies it. Be strict about facts: an address, number or rule that isn't in the records counts as invented.

Reply with a JSON array and nothing else, one object per check, in order: [{"pass": boolean, "why": "one short line"}]`;

export async function judgeChecks(llm: LlmClient, turn: Turn, t: Omit<TurnResult, "checks">): Promise<CheckResult[]> {
  const checks = turn.expected.checks ?? [];
  if (!checks.length) return [];
  const res = await llm.create({
    model: JUDGE_MODEL,
    max_tokens: 1024,
    system: JUDGE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Email from ${turn.from ?? "an unknown sender"}, subject "${turn.subject}":\n${turn.body}`,
          `Program records Ada was given:\n${turn.programInfo ?? "(none)"}`,
          `Ada's action: ${t.actual}${t.reason ? `\nEscalation reason: ${t.reason}` : ""}`,
          `Ada's drafts:\n${t.drafts.length ? t.drafts.map((d, i) => `${i + 1}. to ${d.to.join(", ")}${d.purpose ? ` (${d.purpose})` : ""}\nSubject: ${d.subject}\n${d.body}`).join("\n\n") : "(none)"}`,
          `Checks:\n${checks.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
        ].join("\n\n"),
      },
    ],
  });
  const out = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    const parsed = JSON.parse(out.match(/\[[\s\S]*\]/)?.[0] ?? "") as { pass: boolean; why: string }[];
    return checks.map((check, i) => ({ check, pass: parsed[i]?.pass === true, why: parsed[i]?.why ?? "no verdict" }));
  } catch {
    return checks.map((check) => ({ check, pass: false, why: "judge reply could not be parsed" }));
  }
}

let seq = 0;

export async function runTurn(db: Db, ws: string, llm: { agent: LlmClient; triage: LlmClient; judge: LlmClient }, turn: Turn): Promise<TurnResult> {
  const [sender] = turn.from
    ? await db.select().from(people).where(and(eq(people.workspaceId, ws), eq(people.name, turn.from)))
    : [];
  const id = `${ws}:inbound:holdout-${++seq}`;
  await db.insert(inboundItems).values({
    id,
    workspaceId: ws,
    simDay: 0,
    kind: "email",
    fromPersonId: sender?.id ?? null,
    subject: turn.subject,
    body: turn.body,
  });

  const startupId = turn.expected.startup ? `${ws}:startup:${turn.expected.startup}` : null;
  const riskOf = async () =>
    startupId ? ((await db.select().from(startups).where(eq(startups.id, startupId)))[0]?.riskLevel ?? 0) : 0;
  const riskBefore = await riskOf();

  await handleInbound({ db, llm: llm.agent, triageLlm: llm.triage, programInfo: turn.programInfo }, ws, id);

  const [item] = await db.select().from(inboundItems).where(eq(inboundItems.id, id));
  const rows = await db.select().from(drafts).where(eq(drafts.inboundItemId, id));
  const names = new Map((await db.select().from(people).where(eq(people.workspaceId, ws))).map((p) => [p.id, p.name]));
  const ds: DraftView[] = rows.map((d) => {
    const p = d.payload as { toPersonIds?: string[]; subject?: string; body?: string; purpose?: string };
    return {
      to: (p.toPersonIds ?? []).map((pid) => names.get(pid) ?? pid),
      subject: p.subject ?? d.kind,
      body: p.body ?? JSON.stringify(d.payload),
      purpose: p.purpose,
    };
  });
  const base = { expected: turn.expected, actual: classifyAction(item.state, ds), reason: item.reason, drafts: ds };

  const checks = await judgeChecks(llm.judge, turn, base);
  if (turn.expected.flagAtRisk && startupId) {
    const flagged = await db
      .select()
      .from(facts)
      .where(and(eq(facts.sourceInboundItemId, id), eq(facts.type, "risk_flag")));
    const pass = (await riskOf()) > riskBefore || flagged.length > 0;
    checks.push({ check: `${turn.expected.startup} is flagged at-risk`, pass, why: pass ? "risk raised" : "risk level unchanged" });
  }
  return { ...base, checks };
}

export const readHoldout = (): HoldoutItem[] =>
  readFileSync(path.join(process.cwd(), "evals", "holdout.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as HoldoutItem);

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("set ANTHROPIC_API_KEY first");
  const live = anthropicClient();
  const db = await makePgliteDb();
  const results: ItemResult[] = [];

  for (const item of readHoldout()) {
    // A fresh workspace per item, so one item's risk flags can't leak into the next.
    const ws = `holdout-${item.id}`;
    await seedWorkspace(db, ws);
    const turns: TurnResult[] = [];
    for (const turn of toTurns(item)) turns.push(await runTurn(db, ws, { agent: live, triage: live, judge: live }, turn));
    const r = { id: item.id, source: item.source, needs: item.needs ?? [], turns };
    results.push(r);
    console.log(`${actionPass(r) ? "ok  " : "FAIL"} ${item.id} expected ${turns.map((t) => t.expected.action).join("→")} got ${turns.map((t) => t.actual).join("→")}`);
  }

  const logPath = path.join(process.cwd(), "evals", "holdout-runs.log");
  let previous = 0;
  try {
    previous = readFileSync(logPath, "utf8").split("\n").filter(Boolean).length;
  } catch {}
  const date = new Date().toISOString().slice(0, 10);
  let sha = "unknown";
  try {
    sha = execSync("git rev-parse --short HEAD").toString().trim();
  } catch {}
  const s = scoreHoldout(results);
  writeFileSync(path.join(process.cwd(), "evals", "holdout-results.md"), renderHoldout(results, { date, runNumber: previous + 1, sha }));
  appendFileSync(logPath, `${date} ${sha} action ${s.actionPass}/${s.items} checks ${s.checksPass}/${s.checks} missed-escalations ${s.missedEscalations.length}\n`);
  console.log(`\naction ${s.actionPass}/${s.items}, checks ${s.checksPass}/${s.checks}, missed escalations ${s.missedEscalations.length}. Wrote evals/holdout-results.md`);
}

if (process.argv[1]?.endsWith("holdout.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
