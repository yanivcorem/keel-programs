import Link from "next/link";
import { DraftCard } from "@/components/draft-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { config } from "@/lib/config";
import { pmQueue, startupList, type QueueItem } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

// `tool` is the shape of runs recorded before a step could hold several calls.
type Step = { calls?: { tool: string }[]; tool?: string; text?: string; latencyMs: number };

const TOOL_LABELS: Record<string, string> = {
  get_startup: "Looked up the startup",
  list_sessions: "Read past mentor sessions",
  set_risk: "Updated the risk level",
  log_fact: "Logged a fact for the report",
  get_demo_day_schedule: "Checked the demo day schedule",
  draft_message: "Drafted a message",
  draft_calendar_change: "Drafted a schedule change",
  escalate: "Handed it to you",
};

function QueueLink({ item, selected }: { item: QueueItem; selected: boolean }) {
  const waiting = item.drafts.filter((d) => d.state === "pending").length;
  return (
    <Link
      href={`/pm?item=${encodeURIComponent(item.id)}`}
      data-testid="queue-item"
      className={`block rounded-lg border p-3 text-sm hover:bg-muted ${selected ? "border-foreground" : ""}`}
    >
      <p className="font-medium">{item.subject}</p>
      <p className="text-xs text-muted-foreground">
        Day {item.simDay} · from {item.from ?? "unknown"}
        {waiting ? ` · ${waiting} draft${waiting > 1 ? "s" : ""} to approve` : ""}
      </p>
    </Link>
  );
}

export default async function PmPage({ searchParams }: PageProps<"/pm">) {
  const { db, workspaceId } = await currentWorkspace();
  const [queue, startups] = await Promise.all([pmQueue(db, workspaceId), startupList(db, workspaceId)]);
  const all = [...queue.needsCall, ...queue.handled];
  const requested = (await searchParams).item;
  const selected = all.find((i) => i.id === requested) ?? all[0];
  const startupNames = Object.fromEntries(startups.map((s) => [s.id, s.name]));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold">Needs your call ({queue.needsCall.length})</h2>
          <div className="flex flex-col gap-2">
            {queue.needsCall.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting.</p>
            ) : (
              queue.needsCall.map((i) => <QueueLink key={i.id} item={i} selected={i.id === selected?.id} />)
            )}
          </div>
        </section>
        <section>
          <h2 className="mb-2 text-sm font-semibold">Handled by {config.agentName} ({queue.handled.length})</h2>
          <div className="flex flex-col gap-2">
            {queue.handled.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing yet. Press &ldquo;Advance to next day&rdquo; to send in the next item.
              </p>
            ) : (
              queue.handled.map((i) => <QueueLink key={i.id} item={i} selected={i.id === selected?.id} />)
            )}
          </div>
        </section>
      </div>

      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              {selected.subject}
              {selected.replayed ? <Badge variant="outline">Replaying a recorded run</Badge> : null}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {selected.kind} from {selected.from ?? "unknown"} · day {selected.simDay}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <p className="text-sm whitespace-pre-wrap">{selected.body}</p>

            {selected.state === "needs_call" ? (
              <div className="rounded-lg border border-[var(--signal)]/40 bg-[var(--signal)]/5 p-3 text-sm">
                <p className="font-medium">{config.agentName} handed this to you</p>
                <p>{selected.reason}</p>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-sm font-semibold">What {config.agentName} did</h3>
              <ol className="flex flex-col gap-1 text-sm" data-testid="agent-steps">
                {selected.runs.flatMap((run) =>
                  run.agent === "triage"
                    ? [<li key={run.id}>Sorted it ({run.model})</li>]
                    : (run.steps as Step[]).flatMap((s, i) => {
                        const tools = s.calls?.map((c) => c.tool) ?? (s.tool ? [s.tool] : []);
                        return tools.length
                          ? tools.map((t, j) => <li key={`${run.id}-${i}-${j}`}>{TOOL_LABELS[t] ?? t}</li>)
                          : [<li key={`${run.id}-${i}`}>Summed up: {s.text ?? ""}</li>];
                      }),
                )}
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                Cost of this item: ${selected.costUsd.toFixed(4)}
                {selected.replayed ? " (replayed, no API call)" : ""}
              </p>
            </div>

            {selected.drafts.length ? (
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold">Drafts for your approval</h3>
                {selected.drafts.map((d) => (
                  <DraftCard key={d.id} draft={d} startupNames={startupNames} />
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Press &ldquo;Advance to next day&rdquo; to see {config.agentName} work.</p>
      )}
    </div>
  );
}
