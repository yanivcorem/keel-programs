import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mentorList } from "@/lib/queries";
import { currentWorkspace } from "@/lib/workspace";

export default async function MentorsPage() {
  const { db, workspaceId } = await currentWorkspace();
  const mentors = await mentorList(db, workspaceId);

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {mentors.map((m) => (
        <Card key={m.id}>
          <CardHeader>
            <CardTitle>{m.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{m.sessions.length} sessions this cohort</p>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {m.sessions.map((s) => (
                <li key={`${s.startup}-${s.week}`}>
                  <span className="text-muted-foreground">
                    Week {s.week} · {s.startup}:
                  </span>{" "}
                  {s.notes}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
