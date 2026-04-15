import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const conn =
  globalForDb.conn ?? new Pool({ connectionString: env.DATABASE_URL });
if (env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });
