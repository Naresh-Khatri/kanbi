// runs once on server boot (Next instrumentation hook)
export async function register() {
  // prod only -> don't fire jobs (emails, ai) from dev servers
  if (process.env.NODE_ENV !== "production") return;

  // imports inside the if, not after an early return -> webpack drops the block from the edge bundle
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // throws -> boot fails; never serve against a stale schema
    const { runMigrations } = await import("@/server/db/migrate");
    await runMigrations();

    const { startCronJobs } = await import("@/server/cron/scheduler");
    startCronJobs();
  }
}
