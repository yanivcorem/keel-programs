import type { Db } from "../../src/db/client";
import { inboundItems } from "../../src/db/schema";
import { seedWorkspace } from "../../src/seed/seedWorkspace";
import { makeTestDb } from "./db";

export async function seededDb(workspaceId = "w1"): Promise<Db> {
  const db = await makeTestDb();
  await seedWorkspace(db, workspaceId);
  return db;
}

export async function addInbound(db: Db, workspaceId: string, id: string, body = "test item"): Promise<string> {
  await db.insert(inboundItems).values({
    id,
    workspaceId,
    simDay: 1,
    kind: "email",
    subject: "test",
    body,
  });
  return id;
}
