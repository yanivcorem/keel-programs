import { afterEach, describe, expect, it, vi } from "vitest";

async function loadConfig() {
  vi.resetModules();
  return (await import("../src/lib/config")).config;
}

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the PRD defaults when no env vars are set", async () => {
    for (const key of [
      "NEXT_PUBLIC_PRODUCT_NAME",
      "NEXT_PUBLIC_AGENT_NAME",
      "RATE_LIMIT_RUNS_PER_HOUR",
      "DAILY_SPEND_CAP_USD",
    ]) {
      vi.stubEnv(key, undefined as unknown as string);
    }
    const config = await loadConfig();
    expect(config.productName).toBe("Keel");
    expect(config.agentName).toBe("Ada");
    expect(config.rateLimitRunsPerHour).toBe(10);
    expect(config.dailySpendCapUsd).toBe(5);
    expect(config.models.agent).toBe("claude-sonnet-5-5");
    expect(config.models.triage).toBe("claude-haiku-5-5");
  });

  it("reads the product name from the environment", async () => {
    vi.stubEnv("NEXT_PUBLIC_PRODUCT_NAME", "X");
    const config = await loadConfig();
    expect(config.productName).toBe("X");
  });
});
