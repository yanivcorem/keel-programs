import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { handleInbound } from "../../src/agent/handleInbound";
import type { Db } from "../../src/db/client";
import { agentRuns, drafts, facts, inboundItems, startups } from "../../src/db/schema";
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

  it("money request escalates without a PM run", async () => {
    const db = await seededDb();
    const id = await addInbound(db, "w1", "w1:inbound:3", "stipend advance?");
    const triageLlm = scriptedClient([
      triageReply({ category: "participant_request", startupId: null, escalate: true, reason: "money" }),
    ]);
    const llm = scriptedClient([]);

    await handleInbound({ db, llm, triageLlm }, "w1", id);

    expect((await item(db, id)).state).toBe("needs_call");
    expect(await db.select().from(drafts)).toHaveLength(0);
    expect(await db.select().from(agentRuns).where(eq(agentRuns.agent, "pm"))).toHaveLength(0);
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
