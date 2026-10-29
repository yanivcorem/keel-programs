import type { Db } from "../db/client";
import { events, people, programs, sessions, startups, workspaces } from "../db/schema";
import {
  EVENTS,
  INVESTORS,
  MENTORS,
  PROGRAM,
  PROGRAM_START,
  SESSIONS,
  STAFF,
  STARTUPS,
  slug,
} from "./cohort";

const DAY_MS = 24 * 60 * 60 * 1000;

export const ids = {
  program: (ws: string) => `${ws}:program`,
  startup: (ws: string, key: string) => `${ws}:startup:${key}`,
  person: (ws: string, key: string) => `${ws}:person:${key}`,
  founder: (ws: string, startupKey: string) => `${ws}:person:${startupKey}-founder`,
  session: (ws: string, startupKey: string, week: number) => `${ws}:session:${startupKey}-w${week}`,
  event: (ws: string, key: string) => `${ws}:event:${key}`,
};

const email = (name: string) => `${slug(name)}@example.com`;

// Idempotent and safe under concurrent first requests: the workspace row is claimed first, inside the
// same transaction as the seed, so a second caller waits for the first and then finds it already seeded.
export async function seedWorkspace(db: Db, workspaceId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const claimed = await tx
      .insert(workspaces)
      .values({ id: workspaceId })
      .onConflictDoNothing()
      .returning({ id: workspaces.id });
    if (claimed.length === 0) return;
    await seedRows(tx as unknown as Db, workspaceId);
  });
}

async function seedRows(db: Db, workspaceId: string): Promise<void> {
  const ws = workspaceId;

  await db.insert(programs).values({
    id: ids.program(ws),
    workspaceId: ws,
    name: PROGRAM.name,
    cohort: PROGRAM.cohort,
    week: PROGRAM.week,
    totalWeeks: PROGRAM.totalWeeks,
  });

  await db.insert(startups).values(
    STARTUPS.map((s) => ({
      id: ids.startup(ws, s.key),
      workspaceId: ws,
      name: s.name,
      oneLiner: s.oneLiner,
      status: s.status,
      riskLevel: s.riskLevel,
      demoDaySlot: s.demoDaySlot,
    })),
  );

  await db.insert(people).values([
    ...STARTUPS.map((s) => ({
      id: ids.founder(ws, s.key),
      workspaceId: ws,
      name: s.founder,
      role: "founder" as const,
      email: email(s.founder),
      startupId: ids.startup(ws, s.key),
    })),
    ...MENTORS.map((m) => ({
      id: ids.person(ws, m.key),
      workspaceId: ws,
      name: m.name,
      role: "mentor" as const,
      email: email(m.name),
    })),
    ...INVESTORS.map((i) => ({
      id: ids.person(ws, i.key),
      workspaceId: ws,
      name: i.name,
      role: "investor" as const,
      email: email(i.name),
    })),
    {
      id: ids.person(ws, STAFF.key),
      workspaceId: ws,
      name: STAFF.name,
      role: "staff" as const,
      email: email(STAFF.name),
    },
  ]);

  await db.insert(sessions).values(
    SESSIONS.map((s) => ({
      id: ids.session(ws, s.startup, s.week),
      workspaceId: ws,
      startupId: ids.startup(ws, s.startup),
      mentorId: ids.person(ws, s.mentor),
      week: s.week,
      notes: s.notes,
      heldAt: new Date(PROGRAM_START.getTime() + (s.week - 1) * 7 * DAY_MS),
    })),
  );

  await db.insert(events).values(
    EVENTS.map((e) => ({
      id: ids.event(ws, e.key),
      workspaceId: ws,
      name: e.name,
      kind: e.kind,
      startsAt: e.startsAt,
    })),
  );
}
