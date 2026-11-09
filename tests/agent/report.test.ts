import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { draftWeeklyReport, enforceCitations, factViewsFor, type ReportBody } from "../../src/agent/report";
import { agentRuns, facts, reports } from "../../src/db/schema";
import { scriptedClient } from "../../src/llm/scripted";
import { addInbound, seededDb } from "../helpers/fixtures";
import { text } from "../helpers/llm";

const views = [
  { alias: "F1", id: "w1:fact:a", inboundItemId: "w1:inbound:1", text: 'risk_flag · Kelpforge · {"riskLevel":2,"reason":"co-founder tension"}' },
  { alias: "F2", id: "w1:fact:b", inboundItemId: null, text: 'decision · {"rsvp":"confirmed","confirmed":4}' },
];

describe("citation enforcement", () => {
  it("keeps cited claims and maps aliases to fact ids and source items", () => {
    const out = enforceCitations({ sections: [{ heading: "Risks", claims: [{ text: "Kelpforge is at risk level 2.", factIds: ["F1"] }] }] }, views);
    expect(out.sections[0].claims[0]).toMatchObject({ factIds: ["w1:fact:a"], sources: [{ factId: "w1:fact:a", inboundItemId: "w1:inbound:1" }] });
    expect(out.removed).toEqual([]);
  });

  it("removes a claim with no source, an unknown source, or a number its sources don't contain", () => {
    const out = enforceCitations(
      {
        sections: [
          {
            heading: "Highlights",
            claims: [
              { text: "The cohort is doing great.", factIds: [] },
              { text: "Gridlet closed a round.", factIds: ["F9"] },
              { text: "5 investors confirmed.", factIds: ["F2"] },
              { text: "4 investors confirmed.", factIds: ["F2"] },
            ],
          },
          { heading: "Empty", claims: [{ text: "Nothing.", factIds: [] }] },
        ],
      },
      views,
    );
    expect(out.sections).toHaveLength(1);
    expect(out.sections[0].claims.map((c) => c.text)).toEqual(["4 investors confirmed."]);
    expect(out.removed.map((r) => r.why)).toEqual([
      "no source",
      "cites a fact that doesn't exist",
      "number not in its sources: 5",
      "no source",
    ]);
  });

  it("allows the program's own numbers (the week) without a fact", () => {
    const out = enforceCitations({ sections: [{ heading: "H", claims: [{ text: "Week 5: Kelpforge flagged.", factIds: ["F1"] }] }] }, views, ["5"]);
    expect(out.removed).toEqual([]);
  });
});

describe("draftWeeklyReport", () => {
  it("refuses to run with no facts", async () => {
    const db = await seededDb();
    const res = await draftWeeklyReport(scriptedClient([]), db, "w1");
    expect(res).toMatchObject({ ok: false });
    expect(await db.select().from(agentRuns)).toHaveLength(0);
  });

  it("writes an enforced report and a report run from Ada's facts", async () => {
    const db = await seededDb();
    const src = await addInbound(db, "w1", "w1:inbound:notes", "mentor notes");
    await db.insert(facts).values({
      id: "w1:fact:x",
      workspaceId: "w1",
      type: "risk_flag",
      startupId: "w1:startup:kelpforge",
      data: { riskLevel: 2, reason: "co-founder tension" },
      sourceInboundItemId: src,
    });
    expect((await factViewsFor(db, "w1"))[0].alias).toBe("F1");
    const llm = scriptedClient([
      text(
        JSON.stringify({
          sections: [
            {
              heading: "Risks and follow-ups",
              claims: [
                { text: "Kelpforge moved to risk level 2 over co-founder tension.", factIds: ["F1"] },
                { text: "Three startups are ready to raise.", factIds: [] },
              ],
            },
          ],
        }),
      ),
    ]);

    const res = await draftWeeklyReport(llm, db, "w1");

    expect(res.ok).toBe(true);
    const [r] = await db.select().from(reports);
    const body = r.body as ReportBody;
    expect(body.sections[0].claims).toHaveLength(1);
    expect(body.sections[0].claims[0].sources[0].inboundItemId).toBe(src);
    expect(body.removed).toHaveLength(1);
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.agent, "report"));
    expect(run.id).toBe(r.runId);
  });
});

describe("report faithfulness eval", () => {
  it("parses judge verdicts per claim and marks a missing verdict", async () => {
    const { judgeReport } = await import("../../evals/report");
    const body: ReportBody = {
      sections: [{ heading: "H", claims: [{ text: "a", factIds: ["f1"], sources: [] }, { text: "b", factIds: ["f1"], sources: [] }] }],
      removed: [],
    };
    const judge = scriptedClient([text('[{"verdict": "supported", "why": "in F1"}]', "claude-opus-5-5")]);
    const v = await judgeReport(judge, body, new Map([["f1", "fact one"]]), "rubric");
    expect(v.map((x) => x.verdict)).toEqual(["supported", "no verdict"]);
  });
});
