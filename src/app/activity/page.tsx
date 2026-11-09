import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { config } from "@/lib/config";
import { activity } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

type Step = { calls?: { tool: string }[]; tool?: string; text?: string };

const AGENT: Record<string, string> = { triage: "Triage", pm: config.agentName, report: "Report agent" };

export default async function ActivityPage() {
  const { db, workspaceId } = await currentWorkspace();
  const runs = await activity(db, workspaceId);

  if (!runs.length) {
    return <p className="text-sm text-muted-foreground">Nothing yet. Press &ldquo;Advance to next day&rdquo; and every agent run shows up here.</p>;
  }

  return (
    <ol className="flex flex-col gap-2" data-testid="activity">
      {runs.map((r) => {
        const tools = r.agent === "pm" ? (r.steps as Step[]).flatMap((s) => s.calls?.map((c) => c.tool) ?? (s.tool ? [s.tool] : [])) : [];
        return (
          <li key={r.id} data-testid="activity-run" data-agent={r.agent}>
            <Card>
              <CardContent className="flex flex-col gap-1 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={r.agent === "report" ? "secondary" : "outline"}>{AGENT[r.agent] ?? r.agent}</Badge>
                  {r.inboundItemId ? (
                    <Link href={`/pm?item=${encodeURIComponent(r.inboundItemId)}`} className="font-medium hover:underline">
                      {r.subject ?? "inbound item"}
                    </Link>
                  ) : (
                    <Link href="/reports" className="font-medium hover:underline">
                      Weekly report
                    </Link>
                  )}
                  {r.replayed ? <Badge variant="outline">replayed</Badge> : null}
                </div>
                {tools.length ? <p className="text-muted-foreground">{tools.join(" → ")}</p> : null}
                {r.agent === "pm" && r.factsWritten ? (
                  <p className="text-muted-foreground">Logged {r.factsWritten} fact{r.factsWritten === 1 ? "" : "s"} for the report</p>
                ) : null}
                {r.agent === "report" ? (
                  <p data-testid="handoff">
                    Handoff: read {r.factsRead} facts {config.agentName} logged from{" "}
                    {r.fromItems.map((i, n) => (
                      <span key={i.id}>
                        {n ? ", " : ""}
                        <Link href={`/pm?item=${encodeURIComponent(i.id)}`} className="underline">
                          {i.subject}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : null}
                <p className="font-mono text-xs text-muted-foreground">
                  {r.model} · {r.inputTokens + r.outputTokens} tokens · ${r.costUsd.toFixed(4)} · {(r.latencyMs / 1000).toFixed(1)} s ·{" "}
                  {r.createdAt.toISOString().slice(11, 19)} UTC
                </p>
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
