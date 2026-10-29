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

  it("exports 8 Anthropic tools with object input schemas", () => {
    const tools = toAnthropicTools();
    expect(tools).toHaveLength(8);
    expect(tools.every((t) => t.input_schema.type === "object")).toBe(true);
  });
});
