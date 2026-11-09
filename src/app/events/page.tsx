import { RunSheet } from "@/components/draft-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { eventList, startupList } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

const STATUS: Record<string, string> = { confirmed: "Confirmed", invited: "Not yet", declined: "Declined" };

export default async function EventsPage() {
  const { db, workspaceId } = await currentWorkspace();
  const [list, startups] = await Promise.all([eventList(db, workspaceId), startupList(db, workspaceId)]);
  const startupNames = Object.fromEntries(startups.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-4">
      {list.map((e) => {
        const confirmed = e.guests.filter((g) => g.status === "confirmed").length;
        return (
          <Card key={e.id} data-testid="event-card">
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                {e.name}
                {e.guests.length ? (
                  <Badge variant="outline" data-testid="rsvp-count">
                    {confirmed} of {e.guests.length} confirmed
                  </Badge>
                ) : null}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{e.details}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {e.guests.length ? (
                <ul className="grid gap-1 text-sm sm:grid-cols-2">
                  {e.guests.map((g) => (
                    <li key={g.name} className="flex justify-between gap-2 rounded border px-2 py-1">
                      <span>
                        {g.name}
                        {g.firm ? <span className="text-muted-foreground"> · {g.firm}</span> : null}
                      </span>
                      <span className={g.status === "confirmed" ? "" : "text-muted-foreground"}>{STATUS[g.status]}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {e.runSheet ? (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-semibold">
                    Run sheet <span className="font-normal text-muted-foreground">({e.runSheet.state === "approved" ? "approved" : "draft, waiting for you on the AI Program Manager page"})</span>
                  </p>
                  <RunSheet payload={e.runSheet.payload as Parameters<typeof RunSheet>[0]["payload"]} startupNames={startupNames} />
                </div>
              ) : e.guests.length ? (
                <p className="text-sm text-muted-foreground">No run sheet yet.</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
