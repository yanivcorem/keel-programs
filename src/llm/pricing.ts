// USD per million tokens, Anthropic first-party API rates.
// Source: Anthropic model pricing (platform.claude.com pricing page), as of 2026-10-29.
// Haiku 5.5's rate applies to prompts up to 100K tokens; this app never sends more.
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2.0, output: 10.0 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

export function costUsd(model: string, usage: { input_tokens: number; output_tokens: number }): number {
  const price = PRICES[model];
  if (!price) throw new Error(`unknown model: ${model}`);
  return (usage.input_tokens * price.input + usage.output_tokens * price.output) / 1_000_000;
}
