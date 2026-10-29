import { and, eq, lt } from "drizzle-orm";
import { handleInbound } from "../agent/handleInbound";
import type { Db } from "../db/client";
import { inboundItems, people, workspaces } from "../db/schema";
import { pickClient } from "../guard/guard";
import { SCRIPT } from "../seed/script";
import { seedWorkspace } from "../seed/seedWorkspace";

export const END_OF_SCRIPT = "That's the end of the scripted week. Reset the demo to start again.";

export async function ensureWorkspace(db: Db, workspaceId: string): Promise<void> {
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws) await seedWorkspace(db, workspaceId);
}

export async function advanceDay(
  deps: { db: Db; now?: Date },
  workspaceId: string,
): Promise<{ simDay: number; added: number; message?: string }> {
  const { db } = deps;
  const now = deps.now ?? new Date();
  const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  if (!ws) throw new Error(`workspace ${workspaceId} does not exist`);

  const next = ws.simDay + 1;
  const items = SCRIPT.filter((s) => s.simDay === next);
  if (items.length === 0) return { simDay: ws.simDay, added: 0, message: END_OF_SCRIPT };

  // Claim the day first so a double click can't run the same day twice.
  const claimed = await db
    .update(workspaces)
    .set({ simDay: next })
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.simDay, ws.simDay)))
    .returning({ id: workspaces.id });
  if (claimed.length === 0) return { simDay: next, added: 0 };

  const everyone = await db.select().from(people).where(eq(people.workspaceId, workspaceId));
  for (const [i, item] of items.entries()) {
    const id = `${workspaceId}:inbound:day-${next}-${i}`;
    await db.insert(inboundItems).values({
      id,
      workspaceId,
      simDay: next,
      kind: item.kind,
      fromPersonId: everyone.find((p) => p.name === item.fromName)?.id ?? null,
      subject: item.subject,
      body: item.body,
    });
    const clients = await pickClient(db, workspaceId, now, next);
    await handleInbound({ db, ...clients }, workspaceId, id);
  }
  return { simDay: next, added: items.length };
}

export async function resetDemo(db: Db, workspaceId: string): Promise<void> {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await seedWorkspace(db, workspaceId);
}

export async function deleteStaleWorkspaces(db: Db, olderThanHours = 24, now = new Date()): Promise<number> {
  const deleted = await db
    .delete(workspaces)
    .where(lt(workspaces.createdAt, new Date(now.getTime() - olderThanHours * 3600_000)))
    .returning({ id: workspaces.id });
  return deleted.length;
}
