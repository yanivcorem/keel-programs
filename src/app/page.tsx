import Link from "next/link";
import { StatusBadge, riskLabel } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { config } from "@/lib/config";
import { homeStats, startupList } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

const WEEK = [
  { day: "Mon", what: "Office hours" },
  { day: "Wed", what: "Mentor speed-dating" },
  { day: "Thu", what: "Weekly report due" },
  { day: "Nov 19", what: "Investor panel" },
];

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-xl font-semibold">{value}</CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function Home() {
  const { db, workspaceId } = await currentWorkspace();
  const [stats, startups] = await Promise.all([homeStats(db, workspaceId), startupList(db, workspaceId)]);
  const waiting = stats.needsCall + stats.pendingDrafts;

  return (
    <div className="flex flex-col gap-6">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Startups" value={`${stats.onTrack} on track · ${stats.drifting} drifting · ${stats.atRisk} at risk`} />
        <Stat label="Mentor sessions held" value={String(stats.sessionsHeld)} />
        <Stat label="Next event" value="Investor panel · Nov 19" />
        <Stat label={config.agentName} value={waiting ? `${waiting} need your call →` : "All clear"} href="/pm" />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cohort</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {startups.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/startups/${encodeURIComponent(s.id)}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    Risk: {riskLabel(s.riskLevel)}
                    <StatusBadge status={s.status} />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>This week</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {WEEK.map((w) => (
                <li key={w.what}>
                  <span className="inline-block w-16 text-muted-foreground">{w.day}</span>
                  {w.what}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
