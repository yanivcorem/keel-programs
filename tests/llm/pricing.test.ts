import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { costUsd, PRICES } from "../../src/llm/pricing";
import { scriptedClient } from "../../src/llm/scripted";

const msg = (text: string) =>
  ({
    id: text,
    type: "message",
    role: "assistant",
    model: "claude-haiku-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 1, output_tokens: 1 },
  }) as unknown as Anthropic.Message;

describe("costUsd", () => {
  it("charges the per-million input price", () => {
    expect(costUsd("claude-haiku-5-5", { input_tokens: 1_000_000, output_tokens: 0 })).toBe(
      PRICES["claude-haiku-5-5"].input,
    );
  });

  it("throws on an unknown model", () => {
    expect(() => costUsd("gpt-nope", { input_tokens: 1, output_tokens: 1 })).toThrow(/unknown model/);
  });
});

describe("scriptedClient", () => {
  it("returns responses in order and throws when exhausted", async () => {
    const llm = scriptedClient([msg("a"), msg("b")]);
    const req = { model: "claude-haiku-5-5", max_tokens: 10, messages: [] };
    expect((await llm.create(req)).id).toBe("a");
    expect((await llm.create(req)).id).toBe("b");
    await expect(llm.create(req)).rejects.toThrow("scripted client exhausted");
  });
});
