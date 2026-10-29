import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { agentRuns } from "../db/schema";
import { config } from "../lib/config";
import { anthropicClient, type LlmClient } from "../llm/client";
import { replayClients } from "./replay";

const HOUR_MS = 60 * 60 * 1000;

export type Clients = { llm: LlmClient; triageLlm: LlmClient; replayed: boolean };

// Live runs unless this visitor hit the hourly rate limit, the whole demo hit today's spend cap,
// or there is no API key. Then the visitor gets the recorded run for that day instead.
export async function pickClient(db: Db, workspaceId: string, now: Date, simDay: number): Promise<Clients> {
  const replay = (): Clients => ({ ...replayClients(simDay, workspaceId), replayed: true });
  if (!process.env.ANTHROPIC_API_KEY) return replay();

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
  if (runs >= config.rateLimitRunsPerHour) return replay();

  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [{ spent }] = await db
    .select({ spent: sql<number>`coalesce(sum(${agentRuns.costUsd}), 0)::float` })
    .from(agentRuns)
    .where(gte(agentRuns.createdAt, startOfDay));
  if (spent >= config.dailySpendCapUsd) return replay();

  const live = anthropicClient();
  return { llm: live, triageLlm: live, replayed: false };
}
