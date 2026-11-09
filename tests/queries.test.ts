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

  it("after the scripted week, one item needs a call and three were handled", async () => {
    const db = await seededDb();
    for (let i = 0; i < 4; i++) await advanceDay({ db, now: NOW }, "w1");

    const stats = await homeStats(db, "w1");
    const queue = await pmQueue(db, "w1");

    expect(stats.needsCall).toBe(1);
    expect(queue.handled).toHaveLength(3);
    expect(queue.needsCall).toHaveLength(1);
    expect(queue.handled[0].drafts.length).toBeGreaterThan(0);
    expect(queue.handled.every((q) => q.replayed)).toBe(true);
  });
});

describe("activity", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("lists every run newest first and shows the report's handoff from Ada's items", async () => {
    const { activity } = await import("../src/lib/queries");
    const { draftWeeklyReport } = await import("../src/agent/report");
    const { replayReportClient } = await import("../src/guard/replay");
    const db = await seededDb();
    for (let i = 0; i < 5; i++) await advanceDay({ db, now: NOW }, "w1");
    await draftWeeklyReport(replayReportClient(), db, "w1", { replayed: true });

    const runs = await activity(db, "w1");
    expect(runs[0].agent).toBe("report");
    expect(runs.filter((r) => r.agent === "pm")).toHaveLength(5);
    expect(runs[0].factsRead).toBeGreaterThan(0);
    expect(runs[0].fromItems.length).toBeGreaterThan(0);
  });
});
