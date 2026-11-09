import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { agentRuns, drafts, events, inboundItems, people, programs, rsvps, sessions, startups, workspaces } from "../db/schema";
import { INVESTORS } from "../seed/cohort";

export async function programHeader(db: Db, ws: string) {
  const [program] = await db.select().from(programs).where(eq(programs.workspaceId, ws));
  const [w] = await db.select().from(workspaces).where(eq(workspaces.id, ws));
  return { ...program, simDay: w?.simDay ?? 0 };
}

export async function homeStats(db: Db, ws: string) {
  const all = await db.select({ status: startups.status }).from(startups).where(eq(startups.workspaceId, ws));
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0].n;
  const n = sql<number>`count(*)::int`;
  return {
    onTrack: all.filter((s) => s.status === "on_track").length,
    drifting: all.filter((s) => s.status === "drifting").length,
    atRisk: all.filter((s) => s.status === "at_risk").length,
    sessionsHeld: await count(db.select({ n }).from(sessions).where(eq(sessions.workspaceId, ws))),
    needsCall: await count(
      db
        .select({ n })
        .from(inboundItems)
        .where(and(eq(inboundItems.workspaceId, ws), eq(inboundItems.state, "needs_call"))),
    ),
    pendingDrafts: await count(
      db.select({ n }).from(drafts).where(and(eq(drafts.workspaceId, ws), eq(drafts.state, "pending"))),
    ),
  };
}

export type QueueItem = Awaited<ReturnType<typeof pmQueue>>["handled"][number];

export async function pmQueue(db: Db, ws: string) {
  const items = await db
    .select({
      id: inboundItems.id,
      simDay: inboundItems.simDay,
      kind: inboundItems.kind,
      subject: inboundItems.subject,
      body: inboundItems.body,
      state: inboundItems.state,
      reason: inboundItems.reason,
      urgent: inboundItems.urgent,
      triage: inboundItems.triage,
      from: people.name,
    })
    .from(inboundItems)
    .leftJoin(people, eq(people.id, inboundItems.fromPersonId))
    .where(eq(inboundItems.workspaceId, ws))
    .orderBy(desc(inboundItems.simDay));
  const allDrafts = await db.select().from(drafts).where(eq(drafts.workspaceId, ws)).orderBy(asc(drafts.id));
  const runs = await db.select().from(agentRuns).where(eq(agentRuns.workspaceId, ws)).orderBy(asc(agentRuns.createdAt));
  const names = new Map(
    (await db.select({ id: people.id, name: people.name }).from(people).where(eq(people.workspaceId, ws))).map(
      (p) => [p.id, p.name],
    ),
  );

  const full = items.map((item) => {
    const itemRuns = runs.filter((r) => r.inboundItemId === item.id);
    return {
      ...item,
      drafts: allDrafts
        .filter((d) => d.inboundItemId === item.id)
        .map((d) => ({
          ...d,
          to:
            d.kind === "message"
              ? (d.payload as { toPersonIds: string[] }).toPersonIds.map((id) => names.get(id) ?? id)
              : [],
        })),
      runs: itemRuns,
      replayed: itemRuns.length > 0 && itemRuns.every((r) => r.replayed),
      costUsd: itemRuns.reduce((s, r) => s + r.costUsd, 0),
    };
  });
  return {
    handled: full.filter((i) => i.state === "handled"),
    needsCall: full.filter((i) => i.state === "needs_call"),
  };
}

export async function startupList(db: Db, ws: string) {
  return db.select().from(startups).where(eq(startups.workspaceId, ws)).orderBy(asc(startups.demoDaySlot));
}

export async function startupDetail(db: Db, ws: string, id: string) {
  const [startup] = await db
    .select()
    .from(startups)
    .where(and(eq(startups.id, id), eq(startups.workspaceId, ws)));
  if (!startup) return null;
  const founders = await db.select().from(people).where(eq(people.startupId, id));
  const history = await db
    .select({ week: sessions.week, notes: sessions.notes, mentor: people.name })
    .from(sessions)
    .leftJoin(people, eq(people.id, sessions.mentorId))
    .where(eq(sessions.startupId, id))
    .orderBy(asc(sessions.week));
  return { startup, founders, history };
}

export async function mentorList(db: Db, ws: string) {
  const mentors = await db
    .select()
    .from(people)
    .where(and(eq(people.workspaceId, ws), eq(people.role, "mentor")))
    .orderBy(asc(people.name));
  const all = await db
    .select({ mentorId: sessions.mentorId, week: sessions.week, notes: sessions.notes, startup: startups.name })
    .from(sessions)
    .leftJoin(startups, eq(startups.id, sessions.startupId))
    .where(eq(sessions.workspaceId, ws))
    .orderBy(asc(sessions.week));
  return mentors.map((m) => ({ ...m, sessions: all.filter((s) => s.mentorId === m.id) }));
}

export async function eventList(db: Db, ws: string) {
  const all = await db.select().from(events).where(eq(events.workspaceId, ws)).orderBy(asc(events.startsAt));
  const guests = await db
    .select({ eventId: rsvps.eventId, name: people.name, status: rsvps.status })
    .from(rsvps)
    .innerJoin(people, eq(people.id, rsvps.personId))
    .where(eq(rsvps.workspaceId, ws));
  const sheets = await db
    .select()
    .from(drafts)
    .where(and(eq(drafts.workspaceId, ws), eq(drafts.kind, "run_sheet")));
  return all.map((e) => ({
    ...e,
    guests: guests
      .filter((g) => g.eventId === e.id)
      .map((g) => ({ ...g, firm: INVESTORS.find((i) => i.name === g.name)?.firm ?? null })),
    // The newest run sheet for the event, if Ada has drafted one.
    runSheet: sheets.filter((d) => (d.payload as { eventId: string }).eventId === e.id).at(-1) ?? null,
  }));
}
