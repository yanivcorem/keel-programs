import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Db } from "../db/client";
import { drafts, facts, startups } from "../db/schema";

type CalendarChange = { startupId: string; fromSlot: number; toSlot: number };
type Message = { toPersonIds: string[]; subject: string; body: string };

const Edit = z.object({ subject: z.string().max(300).optional(), body: z.string().max(5000).optional() }).strict();

async function requireDraft(db: Db, workspaceId: string, draftId: string) {
  const [d] = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.workspaceId, workspaceId)));
  if (!d) throw new Error(`draft ${draftId} is not in this workspace`);
  return d;
}

// Approving applies the draft once. A second approve (double click) finds no pending row and does nothing.
export async function approveDraft(
  db: Db,
  workspaceId: string,
  draftId: string,
  edited?: { subject?: string; body?: string },
): Promise<void> {
  const draft = await requireDraft(db, workspaceId, draftId);
  edited = edited === undefined ? undefined : Edit.parse(edited);

  await db.transaction(async (tx) => {
    const payload =
      draft.kind === "message" && edited
        ? { ...(draft.payload as Message), ...edited }
        : (draft.payload as Record<string, unknown>);

    const claimed = await tx
      .update(drafts)
      .set({ state: "approved", appliedAt: new Date(), payload })
      .where(and(eq(drafts.id, draftId), eq(drafts.workspaceId, workspaceId), eq(drafts.state, "pending")))
      .returning({ id: drafts.id });
    if (claimed.length === 0) return;

    if (draft.kind === "calendar_change") {
      const change = payload as CalendarChange;
      const [mover] = await tx
        .select()
        .from(startups)
        .where(and(eq(startups.id, change.startupId), eq(startups.workspaceId, workspaceId)));
      const [holder] = await tx
        .select()
        .from(startups)
        .where(and(eq(startups.workspaceId, workspaceId), eq(startups.demoDaySlot, change.toSlot)));
      if (holder && holder.id !== mover.id) {
        await tx.update(startups).set({ demoDaySlot: mover.demoDaySlot }).where(eq(startups.id, holder.id));
      }
      await tx.update(startups).set({ demoDaySlot: change.toSlot }).where(eq(startups.id, mover.id));
      await tx.insert(facts).values({
        id: `${workspaceId}:fact:${randomUUID()}`,
        workspaceId,
        type: "request_resolved",
        startupId: mover.id,
        data: { change: "demo day slot", from: mover.demoDaySlot, to: change.toSlot, swappedWith: holder?.id ?? null },
        sourceInboundItemId: draft.inboundItemId,
      });
    } else {
      const msg = payload as Message;
      await tx.insert(facts).values({
        id: `${workspaceId}:fact:${randomUUID()}`,
        workspaceId,
        type: "decision",
        data: { action: "message marked sent", subject: msg.subject, to: msg.toPersonIds },
        sourceInboundItemId: draft.inboundItemId,
      });
    }
  });
}

export async function rejectDraft(db: Db, workspaceId: string, draftId: string): Promise<void> {
  await requireDraft(db, workspaceId, draftId);
  await db
    .update(drafts)
    .set({ state: "rejected" })
    .where(and(eq(drafts.id, draftId), eq(drafts.workspaceId, workspaceId), eq(drafts.state, "pending")));
}
