import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { startups, workspaces } from "../../src/db/schema";
import { makeTestDb } from "../helpers/db";

describe("schema", () => {
  it("workspaces are isolated", async () => {
    const db = await makeTestDb();
    await db.insert(workspaces).values([{ id: "a" }, { id: "b" }]);
    await db.insert(startups).values([
      { id: "a:startup:one", workspaceId: "a", name: "Alpha", oneLiner: "x", status: "on_track", riskLevel: 0 },
      { id: "b:startup:one", workspaceId: "b", name: "Beta", oneLiner: "y", status: "drifting", riskLevel: 1 },
    ]);

    const rows = await db.select().from(startups).where(eq(startups.workspaceId, "a"));

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Alpha");
  });
});
