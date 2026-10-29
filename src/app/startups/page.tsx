import Link from "next/link";
import { StatusBadge, riskLabel } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { startupList } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

export default async function StartupsPage() {
  const { db, workspaceId } = await currentWorkspace();
  const startups = await startupList(db, workspaceId);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {startups.map((s) => (
        <Link key={s.id} href={`/startups/${encodeURIComponent(s.id)}`}>
          <Card className="h-full hover:bg-muted/40">
            <CardContent className="flex flex-col gap-2 pt-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{s.name}</p>
                <StatusBadge status={s.status} />
              </div>
              <p className="text-sm text-muted-foreground">{s.oneLiner}</p>
              <p className="text-xs text-muted-foreground">
                Risk: {riskLabel(s.riskLevel)} · Demo day slot {s.demoDaySlot ?? "–"}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
