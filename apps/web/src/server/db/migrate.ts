import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

import { db } from "./index";

// arbitrary app-wide key; serializes boot migrations across replicas
const LOCK_KEY = 4_221_337;

/** Applies pending drizzle/ migrations; same journal table as `drizzle-kit migrate`. */
export async function runMigrations() {
  // standalone server chdirs to apps/web; Dockerfile copies drizzle/ there
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const started = Date.now();
  // advisory lock is per-connection -> lock, migrate, unlock on one client
  const client = await db.$client.connect();
  try {
    await client.query("select pg_advisory_lock($1)", [LOCK_KEY]);
    try {
      await migrate(drizzle(client), { migrationsFolder });
    } finally {
      await client.query("select pg_advisory_unlock($1)", [LOCK_KEY]);
    }
  } finally {
    client.release();
  }
  console.log(`[db] migrations up to date (${Date.now() - started}ms)`);
}
