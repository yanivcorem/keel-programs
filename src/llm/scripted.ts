import type Anthropic from "@anthropic-ai/sdk";
import type { LlmClient } from "./client";

// Returns canned responses in order. Used by tests and by the replay fallback.
export function scriptedClient(responses: Anthropic.Message[]): LlmClient {
  let next = 0;
  return {
    async create() {
      if (next >= responses.length) throw new Error("scripted client exhausted");
      return responses[next++];
    },
  };
}
