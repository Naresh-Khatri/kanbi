import type { Config } from "drizzle-kit";

import { env } from "@/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  tablesFilter: [
    "kanbi_*",
    "user",
    "session",
    "account",
    "verification",
    "oauth_client",
    "oauth_access_token",
    "oauth_refresh_token",
    "oauth_consent",
    "jwks",
  ],
} satisfies Config;
