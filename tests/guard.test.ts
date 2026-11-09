import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleInbound } from "../src/agent/handleInbound";
import type { Db } from "../src/db/client";
import { agentRuns, drafts, startups } from "../src/db/schema";
import { pickClient } from "../src/guard/guard";
import { replayClients } from "../src/guard/replay";
import { seedWorkspace } from "../src/seed/seedWorkspace";
import { addInbound, seededDb } from "./helpers/fixtures";

const NOW = new Date("2026-11-02T12:00:00Z");

async function addRuns(db: Db, ws: string, count: number, costEach: number, at = NOW) {
  for (let i = 0; i < count; i++) {
    await db.insert(agentRuns).values({
      id: `${ws}:run:seed-${i}-${costEach}`,
      workspaceId: ws,
      agent: "pm",
      model: "claude-sonnet-5-5",
      costUsd: costEach,
      createdAt: new Date(at.getTime() - 60_000),
    });
  }
}

describe("pickClient", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", "test-key"));
  afterEach(() => vi.unstubAllEnvs());

  it("goes live under the cap", async () => {
    const db = await seededDb();
    expect((await pickClient(db, "w1", NOW, 1)).replayed).toBe(false);
  });

  it("cap reached uses replay", async () => {
    const db = await seededDb();
    await addRuns(db, "w1", 2, 2.5);
    expect((await pickClient(db, "w1", NOW, 1)).replayed).toBe(true);
  });

  it("rate-limits one workspace without affecting another", async () => {
    const db = await seededDb();
    await seedWorkspace(db, "w2");
    await addRuns(db, "w1", 20, 0.001);
    expect((await pickClient(db, "w1", NOW, 1)).replayed).toBe(true);
    expect((await pickClient(db, "w2", NOW, 1)).replayed).toBe(false);
  });

  it("replays when there is no API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const db = await seededDb();
    expect((await pickClient(db, "w1", NOW, 1)).replayed).toBe(true);
  });
});

describe("replay", () => {
  it("a replayed day 1 produces the moment-1 outcome at zero cost", async () => {
    const db = await seededDb("w9");
    const id = await addInbound(db, "w9", "w9:inbound:d1");
    const { llm, triageLlm } = replayClients(1, "w9");

    await handleInbound({ db, llm, triageLlm, replayed: true }, "w9", id);

    const [kelp] = await db.select().from(startups).where(eq(startups.id, "w9:startup:kelpforge"));
    expect(kelp.riskLevel).toBe(2);
    const d = await db.select().from(drafts).where(eq(drafts.inboundItemId, id));
    expect(d.filter((x) => x.kind === "message" && x.state === "pending")).toHaveLength(1);
    const runs = await db.select().from(agentRuns).where(eq(agentRuns.inboundItemId, id));
    expect(runs.every((r) => r.replayed && r.costUsd === 0)).toBe(true);
  });
});
