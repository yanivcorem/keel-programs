import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "../../src/app/api/cron/cleanup/route";

describe("cron cleanup route", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses every request when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(new Request("http://x/api/cron/cleanup", { headers: { authorization: "Bearer undefined" } }));
    expect(res.status).toBe(401);
  });
});
