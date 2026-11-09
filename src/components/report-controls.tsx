"use client";

import { useActionState, useTransition } from "react";
import { approveReportAction, draftReportAction } from "@/app/actions/demo";
import { Button } from "@/components/ui/button";

export function DraftReportButton({ week, hasReport }: { week: number; hasReport: boolean }) {
  const [state, draft, drafting] = useActionState<{ message?: string } | null>(draftReportAction, null);
  return (
    <form action={draft} className="flex flex-col gap-1">
      <Button type="submit" size="sm" disabled={drafting}>
        {drafting ? "The Report agent is writing…" : hasReport ? `Redraft week ${week} report` : `Draft week ${week} report`}
      </Button>
      {state?.message ? <p className="text-xs text-muted-foreground">{state.message}</p> : null}
    </form>
  );
}

export function ApproveReportButton({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => approveReportAction(reportId))}>
      Approve report
    </Button>
  );
}
