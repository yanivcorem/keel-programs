import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { handleInbound } from "../../src/agent/handleInbound";
import type { Db } from "../../src/db/client";
import { agentRuns, drafts, facts, inboundItems, startups } from "../../src/db/schema";
import { SAFETY_ACK, POLICY } from "../../src/agent/policy";
import { scriptedClient } from "../../src/llm/scripted";
import { addInbound, seededDb } from "../helpers/fixtures";
import { text, toolUse, toolUses, triageReply } from "../helpers/llm";

const KELP = "w1:startup:kelpforge";
const SOIL = "w1:startup:soilmind";

async function item(db: Db, id: string) {
  const [row] = await db.select().from(inboundItems).where(eq(inboundItems.id, id));
  return row;
}

describe("handleInbound", () => {
  it("records every tool call when Ada makes several in one turn", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:multi", "co-founder tension again");
    const triageLlm = scriptedClient([
      triageReply({ category: "mentor_feedback", startupId: KELP, escalate: false, reason: "tension" }),
    ]);
    const llm = scriptedClient([
      toolUses([
        ["set_risk", { startupId: KELP, riskLevel: 2, reason: "tension" }],
        ["log_fact", { type: "risk_flag", startupId: KELP, data: { note: "tension" } }],
        ["draft_message", { toPersonIds: ["w1:person:kelpforge-founder"], subject: "Check-in", body: "Hi Priya" }],
      ]),
      text("Done."),
    ]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const [run] = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.inboundItemId, id), eq(agentRuns.agent, "pm")));
    const first = (run.steps as { calls: { tool: string }[] }[])[0];
    expect(first.calls.map((c) => c.tool)).toEqual(["set_risk", "log_fact", "draft_message"]);
  });

  it("moment 1: mentor notes raise Kelpforge's risk and draft a check-in", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:1", "co-founder tension again");
    const triageLlm = scriptedClient([
      triageReply({ category: "mentor_feedback", startupId: KELP, escalate: false, reason: "second tension flag" }),
    ]);
    const llm = scriptedClient([
      toolUse("get_startup", { name: "Kelpforge" }),
      toolUse("list_sessions", { startupId: KELP }),
      toolUse("set_risk", { startupId: KELP, riskLevel: 2, reason: "second co-founder tension flag in 3 weeks" }),
      toolUse("draft_message", {
        toPersonIds: ["w1:person:kelpforge-founder"],
        subject: "Quick check-in this week",
        body: "Hi Priya, can we grab 30 minutes this week?",
      }),
      text("Raised risk and drafted a check-in."),
    ]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const [kelp] = await db.select().from(startups).where(eq(startups.id, KELP));
    expect(kelp.riskLevel).toBe(2);
    const d = await db.select().from(drafts).where(eq(drafts.inboundItemId, id));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: "message", state: "pending" });
    expect(await db.select().from(facts).where(eq(facts.type, "risk_flag"))).toHaveLength(1);
    expect((await item(db, id)).state).toBe("handled");
    const runs = await db.select().from(agentRuns).where(and(eq(agentRuns.inboundItemId, id), eq(agentRuns.agent, "pm")));
    expect(runs).toHaveLength(1);
    expect(runs[0].costUsd).toBeGreaterThan(0);
  });

  it("moment 2: a slot swap request becomes two pending drafts and no schedule change", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:2", "swap slots please");
    const triageLlm = scriptedClient([
      triageReply({ category: "participant_request", startupId: SOIL, escalate: false, reason: "slot swap" }),
    ]);
    const llm = scriptedClient([
      toolUse("get_demo_day_schedule", {}),
      toolUse("draft_calendar_change", { startupId: SOIL, fromSlot: 2, toSlot: 1 }),
      toolUse("draft_message", {
        toPersonIds: ["w1:person:soilmind-founder"],
        subject: "Demo day slot",
        body: "Swap approved pending sign-off.",
      }),
      text("Drafted the swap and a reply."),
    ]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const [soil] = await db.select().from(startups).where(eq(startups.id, SOIL));
    expect(soil.demoDaySlot).toBe(2);
    expect(await db.select().from(drafts).where(eq(drafts.state, "pending"))).toHaveLength(2);
  });

  it("money request: escalation pass hands it over with no drafts", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:3", "stipend advance?");
    const triageLlm = scriptedClient([
      triageReply({ category: "participant_request", startupId: null, escalate: true, reason: "money" }),
    ]);
    const llm = scriptedClient([toolUse("escalate", { reason: "§1: hardship stipend" })]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const row = await item(db, id);
    expect(row.state).toBe("needs_call");
    expect(row.reason).toBe("§1: hardship stipend");
    expect(await db.select().from(drafts)).toHaveLength(0);
  });

  it("escalation pass can't draft: a draft call ends the pass, nothing is drafted", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:nodraft", "please pay our invoice");
    const triageLlm = scriptedClient([
      triageReply({ category: "participant_request", startupId: null, escalate: true, reason: "§1 invoice" }),
    ]);
    const llm = scriptedClient([toolUse("draft_message", { toPersonIds: ["w1:person:sam"], subject: "x", body: "y" })]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    expect((await item(db, id)).state).toBe("needs_call");
    expect(await db.select().from(drafts)).toHaveLength(0);
  });

  it("escalation pass flags at-risk before handing over (co-founder leaving)", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:leave", "our CTO leaves on Friday");
    const triageLlm = scriptedClient([
      triageReply({ category: "participant_request", startupId: KELP, escalate: true, reason: "§3 co-founder leaves" }),
    ]);
    const llm = scriptedClient([
      toolUse("set_risk", { startupId: KELP, riskLevel: 2, reason: "co-founder leaving" }),
      toolUse("escalate", { reason: "§3: co-founder leaves; flagged at-risk" }),
    ]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const [s] = await db.select().from(startups).where(eq(startups.id, KELP));
    expect(s.riskLevel).toBe(2);
    expect((await item(db, id)).state).toBe("needs_call");
  });

  it("safety report: fixed acknowledgment is sent word for word, then urgent escalation", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:safety", "something happened at the mixer");
    const triageLlm = scriptedClient([
      triageReply({ category: "other", startupId: KELP, escalate: true, reason: "§4 conduct report" }),
    ]);
    const llm = scriptedClient([
      toolUse("send_safety_ack", { toPersonId: "w1:person:kelpforge-founder" }),
      toolUse("send_safety_ack", { toPersonId: "w1:person:kelpforge-founder" }),
      toolUse("escalate", { reason: "§4: conduct report", urgent: true }),
    ]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const d = await db.select().from(drafts);
    expect(d).toHaveLength(1);
    expect(d[0].state).toBe("sent");
    expect((d[0].payload as { body: string }).body).toBe(SAFETY_ACK);
    const row = await item(db, id);
    expect(row.state).toBe("needs_call");
    expect(row.urgent).toBe(true);
  });

  it("escalation pass failure still hands the item over on triage's reason", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:down", "stipend advance?");
    const triageLlm = scriptedClient([
      triageReply({ category: "participant_request", startupId: null, escalate: true, reason: "§1 money" }),
    ]);

    await handleInbound({ db, llm: scriptedClient([]), triageLlm }, "w1", id);

    const row = await item(db, id);
    expect(row.state).toBe("needs_call");
    expect(row.reason).toBe("§1 money");
  });

  it("bad tool call escalates", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:4");
    const triageLlm = scriptedClient([
      triageReply({ category: "other", startupId: null, escalate: false, reason: "unclear" }),
    ]);
    const llm = scriptedClient([toolUse("delete_everything", {})]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const row = await item(db, id);
    expect(row.state).toBe("needs_call");
    expect(row.reason).toMatch(/delete_everything/);
  });

  it("escalate stops the step: no drafts from the same response", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:6");
    const triageLlm = scriptedClient([
      triageReply({ category: "participant_request", startupId: null, escalate: false, reason: "x" }),
    ]);
    const both = toolUse("escalate", { reason: "money" });
    (both.content as unknown[]).push({
      type: "tool_use",
      id: "toolu_extra",
      name: "draft_message",
      input: { toPersonIds: ["w1:person:brinewell-founder"], subject: "s", body: "b" },
    });

    await handleInbound({ db, llm: scriptedClient([both]), triageLlm }, "w1", id);

    expect((await item(db, id)).state).toBe("needs_call");
    expect(await db.select().from(drafts)).toHaveLength(0);
  });

  it("a run that throws mid-loop still records the tokens it spent", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:7");
    const triageLlm = scriptedClient([
      triageReply({ category: "other", startupId: null, escalate: false, reason: "x" }),
    ]);
    const llm = scriptedClient([toolUse("get_demo_day_schedule", {})]);

    await expect(handleInbound({ db, llm, triageLlm }, "w1", id)).rejects.toThrow("scripted client exhausted");

    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.agent, "pm"));
    expect(run.inputTokens).toBe(1000);
    expect(run.costUsd).toBeGreaterThan(0);
  });

  it("step limit escalates", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:5");
    const triageLlm = scriptedClient([
      triageReply({ category: "other", startupId: null, escalate: false, reason: "unclear" }),
    ]);
    const llm = scriptedClient(Array.from({ length: 9 }, () => toolUse("get_demo_day_schedule", {})));

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    const row = await item(db, id);
    expect(row.state).toBe("needs_call");
    expect(row.reason).toBe("step limit");
    const [run] = await db.select().from(agentRuns).where(eq(agentRuns.agent, "pm"));
    expect((run.steps as unknown[]).length).toBe(8);
  });
});

describe("program policy", () => {
  it("the fixed safety acknowledgment matches the policy file word for word", () => {
    expect(POLICY).toContain(`*"${SAFETY_ACK}"*`);
  });

  it("is loaded into both prompts", async () => {
    const { PM_SYSTEM, PM_ESCALATION_SYSTEM, TRIAGE_SYSTEM } = await import("../../src/agent/prompts");
    for (const p of [PM_SYSTEM, PM_ESCALATION_SYSTEM, TRIAGE_SYSTEM]) expect(p).toContain("## 5. Attendance and engagement");
  });
});
