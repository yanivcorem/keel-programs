import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  // Against a deployment with an API key Ada runs live (about 10 s per item), so waits are longer there.
  timeout: process.env.E2E_BASE_URL ? 180_000 : 60_000,
  expect: { timeout: process.env.E2E_BASE_URL ? 45_000 : 5_000 },
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start -- -p 3100",
        url: baseURL,
        reuseExistingServer: false,
        env: { ANTHROPIC_API_KEY: "", DATABASE_URL: "" },
      },
});
