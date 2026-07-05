import { Cron } from "croner";

import { db } from "@/server/db";
import { runDueReminders } from "@/server/notifications/due-reminders";
import { runWeeklyDigests } from "@/server/notifications/weekly-digest";

// register() can fire more than once (dev hmr, worker reuse) -> only wire once
let started = false;

/**
 * In-process cron for self-hosted single-instance deploys. Runs the same jobs
 * as the /api/cron/* routes, called directly (no HTTP, no CRON_SECRET). Started
 * from instrumentation.ts in production. Run only one instance -> extra replicas
 * would double-send digests.
 */
export function startCronJobs() {
  if (started) return;
  started = true;

  // hourly. lookahead is 24h + dedupes, so exact minute doesn't matter
  new Cron("0 * * * *", { name: "due-reminders", protect: true }, async () => {
    try {
      const r = await runDueReminders(db);
      console.log("[cron] due-reminders", r);
    } catch (err) {
      console.error("[cron] due-reminders failed", err);
    }
  });

  // mondays 08:00 server-local
  new Cron("0 8 * * 1", { name: "weekly-digests", protect: true }, async () => {
    try {
      const r = await runWeeklyDigests(db);
      console.log("[cron] weekly-digests", r);
    } catch (err) {
      console.error("[cron] weekly-digests failed", err);
    }
  });

  console.log("[cron] scheduler started");
}
