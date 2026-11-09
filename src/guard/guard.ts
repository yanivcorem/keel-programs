import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { agentRuns } from "../db/schema";
import { config } from "../lib/config";
import { anthropicClient, type LlmClient } from "../llm/client";
import { replayClients, replayReportClient } from "./replay";

const HOUR_MS = 60 * 60 * 1000;

export type Clients = { llm: LlmClient; triageLlm: LlmClient; replayed: boolean };

// Live runs unless this visitor hit the hourly rate limit, the whole demo hit today's spend cap,
// or there is no API key. Then the visitor gets the recorded run for that day instead.
export async function pickClient(db: Db, workspaceId: string, now: Date, simDay: number): Promise<Clients> {
  if (!(await canGoLive(db, workspaceId, now))) return { ...replayClients(simDay, workspaceId), replayed: true };
  const live = anthropicClient();
  return { llm: live, triageLlm: live, replayed: false };
}

// The weekly report runs on the same limits; capped visitors get the recorded report.
export async function pickReportClient(db: Db, workspaceId: string, now: Date): Promise<{ llm: LlmClient; replayed: boolean }> {
  if (!(await canGoLive(db, workspaceId, now))) return { llm: replayReportClient(), replayed: true };
  return { llm: anthropicClient(), replayed: false };
}

export async function canGoLive(db: Db, workspaceId: string, now: Date): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) return false;

  const [{ runs }] = await db
    .select({ runs: sql<number>`count(*)::int` })
    .from(agentRuns)
    .where(
      and(
        eq(agentRuns.workspaceId, workspaceId),
        eq(agentRuns.replayed, false),
        gte(agentRuns.createdAt, new Date(now.getTime() - HOUR_MS)),
      ),
    );
  if (runs >= config.rateLimitRunsPerHour) return false;

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [{ spent }] = await db
    .select({ spent: sql<number>`coalesce(sum(${agentRuns.costUsd}), 0)::float` })
    .from(agentRuns)
    .where(gte(agentRuns.createdAt, startOfDay));
  return spent < config.dailySpendCapUsd;
}
