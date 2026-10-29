import Anthropic from "@anthropic-ai/sdk";

export interface LlmClient {
  create(req: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
}

export function anthropicClient(): LlmClient {
  const client = new Anthropic();
  return { create: (req) => client.messages.create(req) };
}
