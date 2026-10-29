import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { homeStats, pmQueue } from "../src/lib/queries";
import { advanceDay } from "../src/sim/sim";
import { seededDb } from "./helpers/fixtures";

const NOW = new Date("2026-11-02T12:00:00Z");

describe("queries", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("homeStats on a fresh seed matches the seed's statuses", async () => {
    const db = await seededDb();

    expect(await homeStats(db, "w1")).toEqual({
      onTrack: 7,
      drifting: 2,
      atRisk: 1,
      sessionsHeld: 20,
      needsCall: 0,
      pendingDrafts: 0,
    });
  });

  it("after the scripted week, two items need a call and two were handled", async () => {
    const db = await seededDb();
    for (let i = 0; i < 4; i++) await advanceDay({ db, now: NOW }, "w1");

    const stats = await homeStats(db, "w1");
    const queue = await pmQueue(db, "w1");

    expect(stats.needsCall).toBe(2);
    expect(queue.handled).toHaveLength(2);
    expect(queue.needsCall).toHaveLength(2);
    expect(queue.handled[0].drafts.length).toBeGreaterThan(0);
    expect(queue.handled.every((q) => q.replayed)).toBe(true);
  });
});
