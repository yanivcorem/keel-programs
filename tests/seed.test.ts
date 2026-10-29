import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { people, programs, sessions, startups } from "../src/db/schema";
import { SCRIPT } from "../src/seed/script";
import { seedWorkspace } from "../src/seed/seedWorkspace";
import { makeTestDb } from "./helpers/db";

describe("seedWorkspace", () => {
  it("creates the Northwind program with 10 startups, mentors and investors", async () => {
    const db = await makeTestDb();
    await seedWorkspace(db, "w1");

    const [program] = await db.select().from(programs).where(eq(programs.workspaceId, "w1"));
    expect(program).toMatchObject({
      name: "Northwind Climate Accelerator",
      cohort: 2,
      week: 5,
      totalWeeks: 10,
    });
    expect(await db.select().from(startups).where(eq(startups.workspaceId, "w1"))).toHaveLength(10);
    const ppl = await db.select().from(people).where(eq(people.workspaceId, "w1"));
    expect(ppl.filter((p) => p.role === "mentor").length).toBeGreaterThanOrEqual(8);
    expect(ppl.filter((p) => p.role === "investor").length).toBeGreaterThanOrEqual(6);
  });

  it("gives Kelpforge exactly one earlier session that flags co-founder tension", async () => {
    const db = await makeTestDb();
    await seedWorkspace(db, "w1");

    const kelp = await db.select().from(sessions).where(eq(sessions.startupId, "w1:startup:kelpforge"));
    const flagged = kelp.filter((s) => /co-founder tension/i.test(s.notes));
    expect(flagged).toHaveLength(1);
  });

  it("uses only example.com email addresses", async () => {
    const db = await makeTestDb();
    await seedWorkspace(db, "w1");

    const ppl = await db.select().from(people);
    expect(ppl.length).toBeGreaterThan(0);
    expect(ppl.every((p) => p.email.endsWith("@example.com"))).toBe(true);
  });

  it("is deterministic across workspaces and runs", async () => {
    const db = await makeTestDb();
    await seedWorkspace(db, "w1");
    const db2 = await makeTestDb();
    await seedWorkspace(db2, "w1");

    const a = await db.select({ id: startups.id, name: startups.name }).from(startups).orderBy(startups.id);
    const b = await db2.select({ id: startups.id, name: startups.name }).from(startups).orderBy(startups.id);
    expect(a).toEqual(b);
  });

  it("scripts one item per day for days 1 to 4", () => {
    expect(SCRIPT.map((s) => s.simDay)).toEqual([1, 2, 3, 4]);
  });
});
