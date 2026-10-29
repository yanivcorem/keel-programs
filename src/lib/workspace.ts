import { cookies } from "next/headers";
import { getDb, type Db } from "../db/client";
import { ensureWorkspace } from "../sim/sim";

// The proxy sets the cookie before any page renders; this reads it and seeds the demo on first visit.
export async function currentWorkspace(): Promise<{ db: Db; workspaceId: string }> {
  const workspaceId = (await cookies()).get("ws")?.value;
  if (!workspaceId) throw new Error("missing workspace cookie");
  const db = await getDb();
  await ensureWorkspace(db, workspaceId);
  return { db, workspaceId };
}
