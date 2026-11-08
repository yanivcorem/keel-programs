import { readFileSync } from "node:fs";
import path from "node:path";

// The program policy is the single source for what Ada may do alone. It lives in docs/ so humans
// read and edit the same file the agents follow; next.config.ts ships it with the server bundle.
export const POLICY = readFileSync(path.join(process.cwd(), "docs", "program-policy.md"), "utf8");

// Policy default 4: the only text Ada ever sends without approval. Kept in code so no model output
// can change it; a test checks it still matches the policy file word for word.
export const SAFETY_ACK = "Thank you for telling us. Sam will contact you personally today.";
