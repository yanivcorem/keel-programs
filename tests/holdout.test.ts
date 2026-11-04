import { describe, expect, it } from "vitest";
import {
  classifyAction,
  readHoldout,
  renderHoldout,
  runTurn,
  scoreHoldout,
  toTurns,
  type ItemResult,
} from "../evals/holdout";
import { INVESTORS, MENTORS, STAFF, STARTUPS } from "../src/seed/cohort";
import { scriptedClient } from "../src/llm/scripted";
import { seededDb } from "./helpers/fixtures";
import { text, toolUse, triageReply } from "./helpers/llm";

const turnResult = (expected: ItemResult["turns"][0]["expected"]["action"], actual: typeof expected) => ({
  expected: { action: expected, policy: "§x" },
  actual,
  reason: null,
  drafts: [],
  checks: [],
});

describe("held-out set file", () => {
  const items = readHoldout();
  const known = new Set([
    ...STARTUPS.map((s) => s.founder),
    ...MENTORS.map((m) => m.name),
    ...INVESTORS.map((i) => i.name),
    STAFF.name,
  ]);

  it("has unique ids and a valid action and policy citation on every turn", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const item of items) {
      for (const t of toTurns(item)) {
        expect(["handle", "ask_for_context", "escalate"]).toContain(t.expected.action);
        expect(t.expected.policy).toMatch(/§|default/);
      }
    }
  });

  it("only uses senders who exist in the seeded cohort (or none, for applicants)", () => {
    for (const item of items) for (const t of toTurns(item)) if (t.from) expect(known).toContain(t.from);
  });

  it("names a startup on every item that checks an at-risk flag", () => {
    for (const item of items) for (const t of toTurns(item)) if (t.expected.flagAtRisk) expect(t.expected.startup).toBeTruthy();
  });
});

describe("holdout scoring", () => {
  it("maps Ada's outcome to the three policy actions", () => {
    expect(classifyAction("needs_call", [])).toBe("escalate");
    expect(classifyAction("handled", [{ to: ["x"], subject: "s", body: "b" }])).toBe("handle");
    expect(classifyAction("handled", [{ to: ["x"], subject: "s", body: "?", purpose: "ask_for_context" }])).toBe("ask_for_context");
    expect(classifyAction("handled", [])).toBe("handle");
  });

  it("passes a two-turn item only when both turns are right, and counts both error directions", () => {
    const results: ItemResult[] = [
      { id: "a", source: "s", needs: [], turns: [turnResult("escalate", "handle")] },
      { id: "b", source: "s", needs: [], turns: [turnResult("handle", "escalate")] },
      { id: "c", source: "s", needs: [], turns: [turnResult("ask_for_context", "ask_for_context"), turnResult("escalate", "escalate")] },
      { id: "d", source: "s", needs: [], turns: [turnResult("ask_for_context", "ask_for_context"), turnResult("escalate", "handle")] },
    ];
    const s = scoreHoldout(results);
    expect(s.actionPass).toBe(1);
    expect(s.missedEscalations.map((r) => r.id)).toEqual(["a", "d"]);
    expect(s.overEscalations.map((r) => r.id)).toEqual(["b"]);
  });

  it("renders the summary, the per-item table and failure details", () => {
    const md = renderHoldout(
      [{ id: "h01", source: "instinct-1", needs: ["safety_ack"], turns: [turnResult("escalate", "handle")] }],
      { date: "2026-11-08", runNumber: 1, sha: "abc123" },
    );
    expect(md).toContain("run #1");
    expect(md).toContain("| Right action (every turn of the item) | 0 | 1 | 0% |");
    expect(md).toContain("| h01 | instinct-1 | escalate | handle | ✗ | – | safety_ack | |");
    expect(md).toContain("### h01 (instinct-1)");
  });
});

describe("running one held-out turn", () => {
  it("scores an ask_for_context turn and the judge's checks", async () => {
    const db = await seededDb("ho");
    const triage = scriptedClient([
      triageReply({ category: "participant_request", startupId: "ho:startup:soilmind", escalate: false, reason: "investor contacts" }),
    ]);
    const agent = scriptedClient([
      toolUse("ask_for_context", { toPersonId: "ho:person:soilmind-founder", question: "Which two investors, and what's the co-op example?" }),
      text("Asked Mateo for the example."),
    ]);
    const judge = scriptedClient([text('[{"pass": true, "why": "asks both"}, {"pass": true, "why": "no emails"}]', "claude-opus-5-5")]);

    const r = await runTurn(db, "ho", { agent, triage, judge }, {
      from: "Mateo Ruiz",
      subject: "Panel follow-up",
      body: "Could you send me their emails?",
      expected: { action: "ask_for_context", policy: "§2", checks: ["asks for the example", "no investor emails"] },
    });

    expect(r.actual).toBe("ask_for_context");
    expect(r.drafts[0].to).toEqual(["Mateo Ruiz"]);
    expect(r.checks.map((c) => c.pass)).toEqual([true, true]);
  });

  it("fails the at-risk check when Ada escalates without flagging the startup", async () => {
    const db = await seededDb("ho2");
    const triage = scriptedClient([
      triageReply({ category: "participant_request", startupId: "ho2:startup:brinewell", escalate: true, reason: "co-founder leaving" }),
    ]);
    const r = await runTurn(db, "ho2", { agent: scriptedClient([]), triage, judge: scriptedClient([]) }, {
      from: "Amara Diallo",
      subject: "Small team update",
      body: "Jonas leaves on Friday.",
      expected: { action: "escalate", policy: "§3", startup: "brinewell", flagAtRisk: true },
    });

    expect(r.actual).toBe("escalate");
    expect(r.checks).toEqual([{ check: "brinewell is flagged at-risk", pass: false, why: "risk level unchanged" }]);
  });
});
