import { z } from "zod";

const env = z
  .object({
    NEXT_PUBLIC_PRODUCT_NAME: z.string().min(1).default("Keel"),
    NEXT_PUBLIC_AGENT_NAME: z.string().min(1).default("Ada"),
    // A full scripted week is 10 runs (triage + Ada per item) plus the report.
    RATE_LIMIT_RUNS_PER_HOUR: z.coerce.number().int().positive().default(20),
    DAILY_SPEND_CAP_USD: z.coerce.number().positive().default(5),
  })
  .parse(process.env);

export const config = {
  productName: env.NEXT_PUBLIC_PRODUCT_NAME,
  agentName: env.NEXT_PUBLIC_AGENT_NAME,
  rateLimitRunsPerHour: env.RATE_LIMIT_RUNS_PER_HOUR,
  dailySpendCapUsd: env.DAILY_SPEND_CAP_USD,
  models: {
    agent: "claude-sonnet-5-5",
    triage: "claude-haiku-5-5",
  },
};
