import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db/client";
import { agentRuns, facts, inboundItems, programs, reports, startups } from "../db/schema";
import { config } from "../lib/config";
import type { LlmClient } from "../llm/client";
import { costUsd } from "../llm/pricing";

// The Report agent turns the facts Ada logged into the weekly report. It never sees raw email, only
// facts, and every claim must cite at least one of them. The citation rule is enforced here in code,
// not left to the prompt: a claim without a valid source, or with a number its sources don't contain,
// is removed and listed so the program manager sees what was cut.

export const REPORT_SYSTEM = `You write the weekly progress report for a startup accelerator's program manager, from a numbered list of facts the AI program manager recorded this week.

Reply with a single JSON object and nothing else:
{"sections": [{"heading": string, "claims": [{"text": string, "factIds": string[]}]}]}

Rules:
- Every claim is one short sentence and cites the fact ids (like "F3") it rests on. Use only what those facts say. No claim without a fact.
- Copy numbers exactly from the facts. Don't add totals, percentages or dates that aren't in a fact.
- Report risks plainly. Don't soften a risk flag or turn a concern into good news.
- Sections, in this order, and only when there are facts for them: "Highlights", "Risks and follow-ups", "Requests and decisions", "Events".
- Plain, direct English for a busy reader. No filler.`;

const ReportSchema = z.object({
  sections: z.array(
    z.object({ heading: z.string(), claims: z.array(z.object({ text: z.string(), factIds: z.array(z.string()) })) }),
  ),
});

export type Claim = { text: string; factIds: string[]; sources: { factId: string; inboundItemId: string | null }[] };
export type ReportBody = { sections: { heading: string; claims: Claim[] }[]; removed: { text: string; why: string }[] };

type FactView = { alias: string; id: string; text: string; inboundItemId: string | null };

const numbersIn = (s: string) => s.match(/\d+(?:[.,]\d+)?/g) ?? [];

// Pure, so the faithfulness eval and the tests use the same enforcement as the product.
export function enforceCitations(raw: z.infer<typeof ReportSchema>, factViews: FactView[], allowedNumbers: string[] = []): ReportBody {
  const byAlias = new Map(factViews.map((f) => [f.alias, f]));
  const removed: ReportBody["removed"] = [];
  const sections = raw.sections
    .map((sec) => ({
      heading: sec.heading,
      claims: sec.claims.flatMap((c): Claim[] => {
        const cited = c.factIds.map((a) => byAlias.get(a)).filter((f): f is FactView => !!f);
        if (cited.length === 0) {
          removed.push({ text: c.text, why: c.factIds.length ? "cites a fact that doesn't exist" : "no source" });
          return [];
        }
        const sourceText = cited.map((f) => f.text).join(" ");
        const unsupported = numbersIn(c.text).filter((n) => !allowedNumbers.includes(n) && !sourceText.includes(n));
        if (unsupported.length) {
          removed.push({ text: c.text, why: `number not in its sources: ${unsupported.join(", ")}` });
          return [];
        }
        return [
          {
            text: c.text,
            factIds: cited.map((f) => f.id),
            sources: cited.map((f) => ({ factId: f.id, inboundItemId: f.inboundItemId })),
          },
        ];
      }),
    }))
    .filter((sec) => sec.claims.length > 0);
  return { sections, removed };
}

export async function factViewsFor(db: Db, workspaceId: string): Promise<FactView[]> {
  const rows = await db
    .select({ fact: facts, startup: startups.name, subject: inboundItems.subject })
    .from(facts)
    .leftJoin(startups, eq(startups.id, facts.startupId))
    .leftJoin(inboundItems, eq(inboundItems.id, facts.sourceInboundItemId))
    .where(eq(facts.workspaceId, workspaceId))
    .orderBy(asc(facts.createdAt), asc(facts.id));
  return rows.map((r, i) => ({
    alias: `F${i + 1}`,
    id: r.fact.id,
    inboundItemId: r.fact.sourceInboundItemId,
    text: `${r.fact.type}${r.startup ? ` · ${r.startup}` : ""}${r.subject ? ` · from "${r.subject}"` : ""} · ${JSON.stringify(r.fact.data)}`,
  }));
}

export type DraftReportResult = { ok: true; reportId: string } | { ok: false; message: string };

export async function draftWeeklyReport(
  llm: LlmClient,
  db: Db,
  workspaceId: string,
  opts: { replayed?: boolean } = {},
): Promise<DraftReportResult> {
  const [program] = await db.select().from(programs).where(eq(programs.workspaceId, workspaceId));
  const views = await factViewsFor(db, workspaceId);
  if (views.length === 0) return { ok: false, message: "No facts yet. Advance the demo so Ada has something to report." };

  const model = config.models.agent;
  const started = Date.now();
  const res = await llm.create({
    model,
    max_tokens: 4096,
    system: [{ type: "text", text: REPORT_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content:
          `${program.name}, cohort ${program.cohort}, week ${program.week} of ${program.totalWeeks}.\n\nFacts:\n` +
          views.map((v) => `${v.alias}: ${v.text}`).join("\n"),
      },
    ],
  });
  const latencyMs = Date.now() - started;
  const textOut = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");

  const runId = `${workspaceId}:run:${randomUUID()}`;
  await db.insert(agentRuns).values({
    id: runId,
    workspaceId,
    agent: "report",
    inboundItemId: null,
    model,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUsd: opts.replayed ? 0 : costUsd(model, res.usage),
    latencyMs,
    replayed: opts.replayed ?? false,
    steps: [{ factsRead: views.map((v) => v.id), latencyMs }],
  });

  let parsed: z.infer<typeof ReportSchema> | null = null;
  try {
    const match = textOut.match(/\{[\s\S]*\}/);
    const r = match ? ReportSchema.safeParse(JSON.parse(match[0])) : null;
    parsed = r?.success ? r.data : null;
  } catch {
    parsed = null;
  }
  if (!parsed) return { ok: false, message: "The Report agent's answer couldn't be read. Try again." };

  const body = enforceCitations(parsed, views, [String(program.week), String(program.totalWeeks), String(program.cohort)]);
  const reportId = `${workspaceId}:report:${randomUUID()}`;
  await db.insert(reports).values({ id: reportId, workspaceId, week: program.week, body, runId });
  return { ok: true, reportId };
}

export async function approveReport(db: Db, workspaceId: string, reportId: string): Promise<void> {
  await db
    .update(reports)
    .set({ state: "approved" })
    .where(and(eq(reports.id, reportId), eq(reports.workspaceId, workspaceId)));
}
