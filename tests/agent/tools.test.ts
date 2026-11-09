import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { TOOLS, toAnthropicTools, type ToolCtx } from "../../src/agent/tools";
import { drafts, facts, inboundItems, startups } from "../../src/db/schema";
import { seedWorkspace } from "../../src/seed/seedWorkspace";
import { addInbound, seededDb } from "../helpers/fixtures";

async function ctx(): Promise<ToolCtx> {
  const db = await seededDb("w1");
  const inboundItemId = await addInbound(db, "w1", "w1:inbound:t");
  return { db, workspaceId: "w1", inboundItemId };
}

describe("tools", () => {
  it("set_risk updates the startup and logs one risk_flag fact with its source", async () => {
    const c = await ctx();
    await TOOLS.set_risk.run(c, { startupId: "w1:startup:kelpforge", riskLevel: 2, reason: "tension" });

    const [s] = await c.db.select().from(startups).where(eq(startups.id, "w1:startup:kelpforge"));
    expect(s.riskLevel).toBe(2);
    const f = await c.db.select().from(facts).where(eq(facts.type, "risk_flag"));
    expect(f).toHaveLength(1);
    expect(f[0].sourceInboundItemId).toBe("w1:inbound:t");
  });

  it("draft_calendar_change creates a pending draft and leaves the slot alone", async () => {
    const c = await ctx();
    await TOOLS.draft_calendar_change.run(c, { startupId: "w1:startup:soilmind", fromSlot: 2, toSlot: 1 });

    const d = await c.db.select().from(drafts);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ kind: "calendar_change", state: "pending" });
    const [s] = await c.db.select().from(startups).where(eq(startups.id, "w1:startup:soilmind"));
    expect(s.demoDaySlot).toBe(2);
  });

  it("draft_message rejects a person from another workspace", async () => {
    const c = await ctx();
    await seedWorkspace(c.db, "w2");

    await expect(
      TOOLS.draft_message.run(c, { toPersonIds: ["w2:person:dana"], subject: "hi", body: "hi" }),
    ).rejects.toThrow(/not in this workspace/);
  });

  it("escalate marks the inbound item as needing a call", async () => {
    const c = await ctx();
    await TOOLS.escalate.run(c, { reason: "money" });

    const [item] = await c.db
      .select()
      .from(inboundItems)
      .where(and(eq(inboundItems.id, c.inboundItemId), eq(inboundItems.workspaceId, "w1")));
    expect(item.state).toBe("needs_call");
    expect(item.reason).toBe("money");
  });

  it("ask_for_context drafts one question to one person and marks it as a question", async () => {
    const c = await ctx();
    await TOOLS.ask_for_context.run(c, { toPersonId: "w1:person:brinewell-founder", question: "How early, and why?" });

    const d = await c.db.select().from(drafts);
    expect(d).toHaveLength(1);
    expect(d[0].state).toBe("pending");
    expect(d[0].payload).toMatchObject({ toPersonIds: ["w1:person:brinewell-founder"], purpose: "ask_for_context" });
    await expect(TOOLS.ask_for_context.run(c, { toPersonId: "w2:person:x", question: "?" })).rejects.toThrow();
  });

  it("exports 16 Anthropic tools with object input schemas", () => {
    const tools = toAnthropicTools();
    expect(tools).toHaveLength(16);
    expect(tools.every((t) => t.input_schema.type === "object")).toBe(true);
  });

  it("refuses one message to several investors (no shared addresses)", async () => {
    const db = await seededDb();
    const ctx = { db, workspaceId: "w1", inboundItemId: await addInbound(db, "w1", "w1:inbound:inv") };
    await expect(
      TOOLS.draft_message.run(ctx, { toPersonIds: ["w1:person:maren", "w1:person:isaac"], subject: "x", body: "y" }),
    ).rejects.toThrow("one message each");
  });

  it("records an RSVP and counts it on the event", async () => {
    const db = await seededDb();
    const ctx = { db, workspaceId: "w1", inboundItemId: await addInbound(db, "w1", "w1:inbound:rsvp") };
    await TOOLS.set_rsvp.run(ctx, { eventId: "w1:event:investor-panel", personId: "w1:person:felix", status: "confirmed" });
    const e = (await TOOLS.get_event.run(ctx, { name: "investor panel" })) as { confirmed: number; invited: number };
    expect(e).toMatchObject({ confirmed: 4, invited: 6 });
  });
});
