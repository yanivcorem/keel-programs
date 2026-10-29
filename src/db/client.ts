import { PGlite } from "@electric-sql/pglite";
import { Pool } from "@neondatabase/serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import path from "node:path";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export async function makePgliteDb(): Promise<Db> {
  const db = drizzlePglite(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db as unknown as Db;
}

let cached: Promise<Db> | undefined;

// Neon in production; an in-memory PGlite when DATABASE_URL is unset (local dev).
export function getDb(): Promise<Db> {
  cached ??= process.env.DATABASE_URL
    ? Promise.resolve(
        drizzleNeon(new Pool({ connectionString: process.env.DATABASE_URL }), {
          schema,
        }) as unknown as Db,
      )
    : makePgliteDb();
  return cached;
}
