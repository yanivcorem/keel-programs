import type Anthropic from "@anthropic-ai/sdk";
import recorded from "../../fixtures/recorded-runs.json";
import type { LlmClient } from "../llm/client";
import { scriptedClient } from "../llm/scripted";

type Day = { triage: Anthropic.Message[]; pm: Anthropic.Message[] };

export const REPLAY_DAYS = Object.keys(recorded).filter((k) => /^\d+$/.test(k)).map(Number);

// Recorded responses for each scripted day, with "{ws}" swapped for the visitor's workspace id.
export function replayClients(simDay: number, workspaceId: string): { llm: LlmClient; triageLlm: LlmClient } {
  const day = (recorded as unknown as Record<string, Day>)[String(simDay)];
  if (!day) throw new Error(`no recorded run for day ${simDay}`);
  const local = JSON.parse(JSON.stringify(day).replaceAll("{ws}", workspaceId)) as Day;
  return { llm: scriptedClient(local.pm), triageLlm: scriptedClient(local.triage) };
}
