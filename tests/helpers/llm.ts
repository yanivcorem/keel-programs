import type Anthropic from "@anthropic-ai/sdk";

let n = 0;
const usage = { input_tokens: 1000, output_tokens: 200 };

export function toolUse(name: string, input: unknown, model = "claude-sonnet-5-5"): Anthropic.Message {
  n += 1;
  return {
    id: `msg_${n}`,
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "tool_use", id: `toolu_${n}`, name, input }],
    stop_reason: "tool_use",
    usage,
  } as unknown as Anthropic.Message;
}

export function text(t: string, model = "claude-sonnet-5-5"): Anthropic.Message {
  n += 1;
  return {
    id: `msg_${n}`,
    type: "message",
    role: "assistant",
    model,
    content: [{ type: "text", text: t }],
    stop_reason: "end_turn",
    usage,
  } as unknown as Anthropic.Message;
}

export const triageReply = (t: object) => text(JSON.stringify(t), "claude-haiku-5-5");
