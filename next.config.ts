import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  // Ada reads the program policy from docs/ at runtime (src/agent/policy.ts).
  outputFileTracingIncludes: { "/**": ["./docs/program-policy.md"] },
};

export default nextConfig;
