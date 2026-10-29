"use server";

import { revalidatePath } from "next/cache";
import { approveDraft, rejectDraft } from "@/agent/approvals";
import { currentWorkspace } from "@/lib/workspace";
import { advanceDay, resetDemo } from "@/sim/sim";

export type AdvanceState = { message?: string } | null;

export async function advanceAction(): Promise<AdvanceState> {
  const { db, workspaceId } = await currentWorkspace();
  const res = await advanceDay({ db }, workspaceId);
  revalidatePath("/", "layout");
  return { message: res.message };
}

export async function resetAction(): Promise<void> {
  const { db, workspaceId } = await currentWorkspace();
  await resetDemo(db, workspaceId);
  revalidatePath("/", "layout");
}

export async function approveAction(draftId: string, edited?: { subject?: string; body?: string }): Promise<void> {
  const { db, workspaceId } = await currentWorkspace();
  await approveDraft(db, workspaceId, draftId, edited);
  revalidatePath("/", "layout");
}

export async function rejectAction(draftId: string): Promise<void> {
  const { db, workspaceId } = await currentWorkspace();
  await rejectDraft(db, workspaceId, draftId);
  revalidatePath("/", "layout");
}
