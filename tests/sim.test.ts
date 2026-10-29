import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { approveDraft } from "../src/agent/approvals";
import { drafts, inboundItems, startups, workspaces } from "../src/db/schema";
import { advanceDay, deleteStaleWorkspaces, ensureWorkspace, resetDemo } from "../src/sim/sim";
import { makeTestDb } from "./helpers/db";
import { seededDb } from "./helpers/fixtures";

const NOW = new Date("2026-11-02T12:00:00Z");

describe("simulation", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("advancing from day 0 adds and handles day 1's item", async () => {
    const db = await seededDb();

    const res = await advanceDay({ db, now: NOW }, "w1");

    expect(res).toMatchObject({ simDay: 1, added: 1 });
    const items = await db.select().from(inboundItems).where(eq(inboundItems.workspaceId, "w1"));
    expect(items).toHaveLength(1);
    expect(items[0].state).toBe("handled");
    expect(items[0].fromPersonId).toBe("w1:person:dana");
  });

  it("advance past end is a no-op", async () => {
    const db = await seededDb();
    for (let i = 0; i < 4; i++) await advanceDay({ db, now: NOW }, "w1");

    const res = await advanceDay({ db, now: NOW }, "w1");

    expect(res).toEqual({
      simDay: 4,
      added: 0,
      message: "That's the end of the scripted week. Reset the demo to start again.",
    });
    expect(await db.select().from(inboundItems)).toHaveLength(4);
  });

  it("reset after approvals restores Soilmind's slot and day 0", async () => {
    const db = await seededDb();
    await advanceDay({ db, now: NOW }, "w1");
    await advanceDay({ db, now: NOW }, "w1");
    for (const d of await db.select().from(drafts)) await approveDraft(db, "w1", d.id);
    const [moved] = await db.select().from(startups).where(eq(startups.id, "w1:startup:soilmind"));
    expect(moved.demoDaySlot).toBe(1);

    await resetDemo(db, "w1");

    const [soil] = await db.select().from(startups).where(eq(startups.id, "w1:startup:soilmind"));
    expect(soil.demoDaySlot).toBe(2);
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, "w1"));
    expect(ws.simDay).toBe(0);
    expect(await db.select().from(inboundItems)).toHaveLength(0);
  });

  it("stale-workspace cleanup deletes a 25h-old workspace and keeps a 1h-old one", async () => {
    const db = await makeTestDb();
    await db.insert(workspaces).values([
      { id: "old", createdAt: new Date(NOW.getTime() - 25 * 3600_000) },
      { id: "new", createdAt: new Date(NOW.getTime() - 1 * 3600_000) },
    ]);

    const deleted = await deleteStaleWorkspaces(db, 24, NOW);

    expect(deleted).toBe(1);
    expect((await db.select().from(workspaces)).map((w) => w.id)).toEqual(["new"]);
  });

  it("concurrent first requests seed a new visitor once", async () => {
    const db = await makeTestDb();

    await Promise.all([ensureWorkspace(db, "v2"), ensureWorkspace(db, "v2"), ensureWorkspace(db, "v2")]);

    expect(await db.select().from(startups).where(eq(startups.workspaceId, "v2"))).toHaveLength(10);
  });

  it("ensureWorkspace seeds a new visitor once", async () => {
    const db = await makeTestDb();

    await ensureWorkspace(db, "v1");
    await ensureWorkspace(db, "v1");

    expect(await db.select().from(startups).where(eq(startups.workspaceId, "v1"))).toHaveLength(10);
  });
});
