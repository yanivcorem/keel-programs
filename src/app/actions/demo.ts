"use server";

import { revalidatePath } from "next/cache";
import { approveDraft, rejectDraft } from "@/agent/approvals";
import { approveReport, draftWeeklyReport } from "@/agent/report";
import { pickReportClient } from "@/guard/guard";
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

export async function draftReportAction(): Promise<{ message?: string }> {
  const { db, workspaceId } = await currentWorkspace();
  const { llm, replayed } = await pickReportClient(db, workspaceId, new Date());
  let res;
  try {
    res = await draftWeeklyReport(llm, db, workspaceId, { replayed });
  } catch (err) {
    console.error("report failed", err);
    return { message: "The Report agent is unavailable right now. Try again in a minute." };
  }
  revalidatePath("/", "layout");
  return res.ok ? {} : { message: res.message };
}

export async function approveReportAction(reportId: string): Promise<void> {
  const { db, workspaceId } = await currentWorkspace();
  await approveReport(db, workspaceId, reportId);
  revalidatePath("/", "layout");
}
