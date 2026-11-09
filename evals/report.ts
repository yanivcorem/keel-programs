// Report faithfulness eval: seeds a fixed week of facts, runs the Report agent live, then grades every
// claim against the facts it cites with a separate judge model and evals/report-rubric.md.
// The code-enforced citation check runs first, so the judge only sees claims that survived it.
// Usage: ANTHROPIC_API_KEY=... npm run eval:report
import { execSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { draftWeeklyReport, factViewsFor, type ReportBody } from "../src/agent/report";
import { makePgliteDb, type Db } from "../src/db/client";
import { facts, inboundItems, reports } from "../src/db/schema";
import { anthropicClient, type LlmClient } from "../src/llm/client";
import { seedWorkspace } from "../src/seed/seedWorkspace";
import { JUDGE_MODEL } from "./holdout";

const WS = "report-eval";

// A fixed week, with traps: a risk that's easy to soften, drafts that aren't approved yet, exact numbers.
export const WEEK: { type: "session_held" | "risk_flag" | "decision" | "request_resolved" | "milestone_hit"; startup?: string; subject: string; data: Record<string, unknown> }[] = [
  { type: "risk_flag", startup: "kelpforge", subject: "Session notes: Kelpforge, week 5", data: { riskLevel: 2, reason: "second co-founder tension flag in three weeks; no agreed next steps" } },
  { type: "session_held", startup: "kelpforge", subject: "Session notes: Kelpforge, week 5", data: { week: 5, mentor: "Dana Whitfield", summary: "product progress fine; fundraising timeline disagreement" } },
  { type: "risk_flag", startup: "aqualedger", subject: "Aqualedger check-in", data: { riskLevel: 2, reason: "mentor doubts they'll have a demo by Dec 10; pipeline flat since week 2" } },
  { type: "milestone_hit", startup: "coolpath", subject: "Coolpath update", data: { milestone: "paid pilot converted to a contract", customers: 1 } },
  { type: "request_resolved", startup: "soilmind", subject: "Demo day slot", data: { change: "demo day slot", from: 2, to: 1, state: "drafted, awaiting approval" } },
  { type: "decision", startup: "brinewell", subject: "Stipend advance", data: { topic: "early stipend", decision: "yes drafted, awaiting approval", amountEur: 2000 } },
  { type: "decision", subject: "Nov 19 panel", data: { rsvp: "confirmed", guest: "Felix Ortega", confirmed: 4, invited: 6 } },
  { type: "session_held", startup: "voltcycle", subject: "Voltcycle notes", data: { week: 5, mentor: "Ruth Adeyemi", summary: "deck ready; two investor conversations booked" } },
];

async function seedWeek(db: Db) {
  await seedWorkspace(db, WS);
  for (const [i, f] of WEEK.entries()) {
    const item = `${WS}:inbound:r${i}`;
    await db.insert(inboundItems).values({ id: item, workspaceId: WS, simDay: 0, kind: "email", subject: f.subject, body: "(eval)" });
    await db.insert(facts).values({
      id: `${WS}:fact:${String(i).padStart(2, "0")}`,
      workspaceId: WS,
      type: f.type,
      startupId: f.startup ? `${WS}:startup:${f.startup}` : null,
      data: f.data,
      sourceInboundItemId: item,
      createdAt: new Date(Date.UTC(2026, 10, 2, 9, i)),
    });
  }
}

type Verdict = { claim: string; verdict: string; why: string };

export async function judgeReport(judge: LlmClient, body: ReportBody, factText: Map<string, string>, rubric: string): Promise<Verdict[]> {
  const claims = body.sections.flatMap((s) => s.claims);
  if (!claims.length) return [];
  const res = await judge.create({
    model: JUDGE_MODEL,
    max_tokens: 2048,
    system: `You grade each claim in an accelerator's weekly report against only the facts it cites, using this rubric:\n\n${rubric}\n\nReply with a JSON array and nothing else, one object per claim, in order: [{"verdict": "supported" | "unsupported" | "softened" | "overstated", "why": "one short line"}]`,
    messages: [
      {
        role: "user",
        content: claims
          .map((c, i) => `${i + 1}. Claim: ${c.text}\n   Cited facts:\n${c.factIds.map((id) => `   - ${factText.get(id)}`).join("\n")}`)
          .join("\n\n"),
      },
    ],
  });
  const out = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  let parsed: { verdict: string; why: string }[] = [];
  try {
    parsed = JSON.parse(out.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
  } catch {
    parsed = [];
  }
  return claims.map((c, i) => ({ claim: c.text, verdict: parsed[i]?.verdict ?? "no verdict", why: parsed[i]?.why ?? "" }));
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("set ANTHROPIC_API_KEY first");
  const live = anthropicClient();
  const db = await makePgliteDb();
  await seedWeek(db);
  const res = await draftWeeklyReport(live, db, WS);
  if (!res.ok) throw new Error(res.message);
  const [r] = await db.select().from(reports);
  const body = r.body as ReportBody;
  const factText = new Map((await factViewsFor(db, WS)).map((v) => [v.id, v.text]));
  const rubric = readFileSync(path.join(process.cwd(), "evals", "report-rubric.md"), "utf8");
  const verdicts = await judgeReport(live, body, factText, rubric);

  const supported = verdicts.filter((v) => v.verdict === "supported").length;
  const commit = execSync("git rev-parse --short HEAD").toString().trim();
  const lines = [
    `# Report faithfulness results`,
    "",
    `Run ${new Date().toISOString().slice(0, 10)} (commit ${commit}). ${WEEK.length} facts in, ${verdicts.length} claims kept, ${body.removed.length} removed by the code check.`,
    "",
    `**Supported: ${supported}/${verdicts.length}.**`,
    "",
    "| Claim | Verdict | Why |",
    "|---|---|---|",
    ...verdicts.map((v) => `| ${v.claim.replaceAll("|", "/")} | ${v.verdict} | ${v.why.replaceAll("|", "/")} |`),
    "",
    "## Removed by the code check",
    "",
    ...(body.removed.length ? body.removed.map((x) => `- "${x.text}" (${x.why})`) : ["(none)"]),
    "",
  ];
  writeFileSync(path.join(process.cwd(), "evals", "report-results.md"), lines.join("\n"));
  appendFileSync(path.join(process.cwd(), "evals", "report-runs.log"), `${new Date().toISOString().slice(0, 10)} ${commit} supported ${supported}/${verdicts.length} removed ${body.removed.length}\n`);
  console.log(lines.join("\n"));
}

if (process.argv[1]?.endsWith("report.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
