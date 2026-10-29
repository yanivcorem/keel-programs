"use client";

import { useState, useTransition } from "react";
import { approveAction, rejectAction } from "@/app/actions/demo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  id: string;
  kind: "message" | "calendar_change";
  state: "pending" | "approved" | "rejected";
  payload: unknown;
  to: string[];
};

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
          {draft.kind === "message" ? `Message to ${draft.to.join(", ")}` : "Demo day schedule change"}
        </p>
        <Badge variant={draft.state === "pending" ? "outline" : draft.state === "approved" ? "secondary" : "destructive"}>
          {draft.state === "pending" ? "Waiting for you" : draft.state === "approved" ? "Approved" : "Rejected"}
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
              startTransition(() => approveAction(draft.id, editing && body !== msg.body ? { body } : undefined))
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
