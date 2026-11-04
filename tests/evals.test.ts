import { describe, expect, it } from "vitest";
import { evalTriageItem, renderTable, score } from "../evals/run";
import { scriptedClient } from "../src/llm/scripted";
import { seededDb } from "./helpers/fixtures";
import { triageReply } from "./helpers/llm";

describe("eval scoring", () => {
  it("passes a triage item only when category, startup and the escalate decision all match", () => {
    const expected = { category: "mentor_feedback", startup: "kelpforge", action: "handle" } as const;
    const s = score({
      triage: [
        { expected, actual: { category: "mentor_feedback", startup: "kelpforge", escalate: false } },
        { expected, actual: { category: "mentor_feedback", startup: "kelpforge", escalate: true } },
        { expected, actual: { category: "mentor_feedback", startup: null, escalate: false } },
      ],
      policy: [],
    });
    expect(s.triage).toEqual({ items: 3, pass: 1 });
  });

  it("treats ask_for_context as not escalated at triage", () => {
    const s = score({
      triage: [
        {
          expected: { category: "participant_request", startup: "brinewell", action: "ask_for_context" },
          actual: { category: "participant_request", startup: "brinewell", escalate: false },
        },
      ],
      policy: [],
    });
    expect(s.triage).toEqual({ items: 1, pass: 1 });
  });

  it("passes an escalate policy item only when it ends needs_call with zero drafts", () => {
    const s = score({
      triage: [],
      policy: [
        { expected: "escalate", state: "needs_call", draftPurposes: [] },
        { expected: "escalate", state: "needs_call", draftPurposes: [undefined] },
        { expected: "escalate", state: "handled", draftPurposes: [] },
      ],
    });
    expect(s.policy).toEqual({ items: 3, pass: 1 });
  });

  it("scores ruled policy items (p01 handle, p10 ask_for_context) by Ada's action", () => {
    const s = score({
      triage: [],
      policy: [
        { expected: "handle", state: "handled", draftPurposes: [undefined] },
        { expected: "handle", state: "needs_call", draftPurposes: [] },
        { expected: "ask_for_context", state: "handled", draftPurposes: ["ask_for_context"] },
        { expected: "ask_for_context", state: "handled", draftPurposes: ["ask_for_context", undefined] },
      ],
    });
    expect(s.policy).toEqual({ items: 4, pass: 2 });
  });

  it("renders the results table with the expected headers", () => {
    const table = renderTable(
      { triage: { items: 40, pass: 38 }, policy: { items: 12, pass: 12 } },
      { costPerStartupWeekUsd: 0.0123, p50StepLatencyMs: 900 },
    );
    expect(table).toContain("| Eval | Items | Pass | Pass rate |");
    expect(table).toContain("| Triage accuracy | 40 | 38 | 95% |");
    expect(table).toContain("| Cost per startup per week (USD) | p50 latency per agent step (ms) |");
  });

  it("evaluates one triage item against a scripted model", async () => {
    const db = await seededDb("eval");
    const llm = scriptedClient([
      triageReply({ category: "mentor_feedback", startupId: "eval:startup:kelpforge", escalate: false, reason: "x" }),
    ]);
    const r = await evalTriageItem(db, "eval", llm, {
      id: "t01",
      from: "Dana Whitfield",
      subject: "s",
      body: "b",
      expected: { category: "mentor_feedback", startup: "kelpforge", action: "handle" },
    });
    expect(r.actual).toEqual({ category: "mentor_feedback", startup: "kelpforge", escalate: false });
  });
});
