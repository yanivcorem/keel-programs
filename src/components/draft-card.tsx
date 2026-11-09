"use client";

import { useState, useTransition } from "react";
import { approveAction, rejectAction } from "@/app/actions/demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { editFor } from "@/lib/drafts";

type Draft = {
  id: string;
  kind: "message" | "calendar_change" | "run_sheet";
  state: "pending" | "approved" | "rejected" | "sent";
  payload: unknown;
  to: string[];
};

type RunSheetPayload = {
  agenda: { time: string; item: string }[];
  pitchOrder: { startupId: string; why: string }[];
  notes?: string;
};

export function RunSheet({ payload, startupNames }: { payload: RunSheetPayload; startupNames: Record<string, string> }) {
  return (
    <div className="flex flex-col gap-3 text-sm" data-testid="run-sheet">
      <ul className="flex flex-col gap-1">
        {payload.agenda.map((a, i) => (
          <li key={i}>
            <span className="font-mono text-xs text-muted-foreground">{a.time}</span> {a.item}
          </li>
        ))}
      </ul>
      <div>
        <p className="font-medium">Suggested pitch order</p>
        <ol className="list-decimal pl-5">
          {payload.pitchOrder.map((p) => (
            <li key={p.startupId}>
              {startupNames[p.startupId] ?? p.startupId}: <span className="text-muted-foreground">{p.why}</span>
            </li>
          ))}
        </ol>
      </div>
      {payload.notes ? <p className="text-muted-foreground">{payload.notes}</p> : null}
    </div>
  );
}

export function DraftCard({ draft, startupNames }: { draft: Draft; startupNames: Record<string, string> }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const msg = draft.payload as { subject?: string; body?: string };
  const change = draft.payload as { startupId?: string; fromSlot?: number; toSlot?: number };
  const [body, setBody] = useState(msg.body ?? "");

  return (
    <div className="rounded-lg border p-4" data-testid="draft-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {draft.kind === "message"
            ? `Message to ${draft.to.join(", ")}`
            : draft.kind === "run_sheet"
              ? "Run sheet"
              : "Demo day schedule change"}
        </p>
        <Badge
          variant={
            draft.state === "pending" ? "outline" : draft.state === "rejected" ? "destructive" : "secondary"
          }
        >
          {
            {
              pending: "Waiting for you",
              approved: "Approved",
              rejected: "Rejected",
              sent: "Sent automatically (fixed safety reply)",
            }[draft.state]
          }
        </Badge>
      </div>

      {draft.kind === "message" ? (
        <>
          <p className="text-sm text-muted-foreground">Subject: {msg.subject}</p>
          {editing ? (
            <Textarea className="mt-2" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          ) : (
            <p className="mt-2 text-sm whitespace-pre-wrap">{body}</p>
          )}
        </>
      ) : draft.kind === "run_sheet" ? (
        <RunSheet payload={draft.payload as RunSheetPayload} startupNames={startupNames} />
      ) : (
        <p className="text-sm">
          Move {startupNames[change.startupId ?? ""] ?? change.startupId} from slot {change.fromSlot} to slot{" "}
          {change.toSlot}. Whoever holds slot {change.toSlot} takes slot {change.fromSlot}.
        </p>
      )}

      {draft.state === "pending" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(() => approveAction(draft.id, editFor(msg.body, body)))
            }
          >
            {draft.kind === "message" ? "Approve (mark sent)" : "Approve"}
          </Button>
          {draft.kind === "message" ? (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing((e) => !e)}>
              {editing ? "Done editing" : "Edit"}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => startTransition(() => rejectAction(draft.id))}>
            Reject
          </Button>
        </div>
      ) : null}
    </div>
  );
}
