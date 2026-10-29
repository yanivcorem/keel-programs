import { notFound } from "next/navigation";
import { StatusBadge, riskLabel } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { startupDetail } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

export default async function StartupPage({ params }: PageProps<"/startups/[id]">) {
  const { db, workspaceId } = await currentWorkspace();
  const detail = await startupDetail(db, workspaceId, decodeURIComponent((await params).id));
  if (!detail) notFound();
  const { startup, founders, history } = detail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">{startup.name}</h2>
          <StatusBadge status={startup.status} />
        </div>
        <p className="text-muted-foreground">{startup.oneLiner}</p>
        <p className="mt-1 text-sm">
          Risk: {riskLabel(startup.riskLevel)} · Demo day slot {startup.demoDaySlot ?? "–"} · Founder:{" "}
          {founders.map((f) => f.name).join(", ")}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Mentor sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-3">
            {history.map((h) => (
              <li key={h.week} className="text-sm">
                <p className="text-xs text-muted-foreground">
                  Week {h.week} · {h.mentor}
                </p>
                <p>{h.notes}</p>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
