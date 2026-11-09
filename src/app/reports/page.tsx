import Link from "next/link";
import type { ReportBody } from "@/agent/report";
import { ApproveReportButton, DraftReportButton } from "@/components/report-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { latestReport, programHeader } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

export default async function ReportsPage() {
  const { db, workspaceId } = await currentWorkspace();
  const [program, latest] = await Promise.all([programHeader(db, workspaceId), latestReport(db, workspaceId)]);
  const body = latest?.report.body as ReportBody | undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-sm text-muted-foreground">
          The Report agent writes the weekly report from the facts Ada logged, and nothing else. Every sentence links to
          its source. Code removes any sentence without one, or with a number its sources don&rsquo;t contain.
        </p>
        <DraftReportButton week={program.week} hasReport={!!latest} />
      </div>

      {latest && body ? (
        <Card data-testid="report">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Week {latest.report.week} report
              <Badge variant={latest.report.state === "approved" ? "secondary" : "outline"}>
                {latest.report.state === "approved" ? "Approved" : "Draft"}
              </Badge>
              {latest.run?.replayed ? <Badge variant="outline">Replaying a recorded run</Badge> : null}
            </CardTitle>
            {latest.run ? (
              <p className="text-xs text-muted-foreground">
                {latest.run.model} · {latest.run.inputTokens + latest.run.outputTokens} tokens · ${latest.run.costUsd.toFixed(4)} ·{" "}
                {(latest.run.latencyMs / 1000).toFixed(1)} s
              </p>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {body.sections.map((sec) => (
              <section key={sec.heading}>
                <h3 className="mb-2 text-sm font-semibold">{sec.heading}</h3>
                <ul className="flex flex-col gap-2 text-sm">
                  {sec.claims.map((c, i) => (
                    <li key={i} data-testid="report-claim">
                      {c.text}{" "}
                      {c.sources.map((s, j) =>
                        s.inboundItemId ? (
                          <Link
                            key={j}
                            href={`/pm?item=${encodeURIComponent(s.inboundItemId)}`}
                            className="ml-1 rounded border px-1 font-mono text-xs text-muted-foreground hover:text-foreground"
                          >
                            source {j + 1}
                          </Link>
                        ) : (
                          <span key={j} className="ml-1 rounded border px-1 font-mono text-xs text-muted-foreground">
                            record
                          </span>
                        ),
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {body.removed.length ? (
              <section className="rounded-lg border border-dashed p-3">
                <h3 className="mb-1 text-sm font-semibold">Removed: no source</h3>
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground" data-testid="report-removed">
                  {body.removed.map((r, i) => (
                    <li key={i}>
                      &ldquo;{r.text}&rdquo; ({r.why})
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {latest.report.state === "draft" ? <ApproveReportButton reportId={latest.report.id} /> : null}
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">No report yet. Advance a few days, then draft one.</p>
      )}
    </div>
  );
}
