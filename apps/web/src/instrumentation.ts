// runs once on server boot (Next instrumentation hook)
export async function register() {
  // nodejs runtime only -> skip edge; scheduler needs long-lived process + pg
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // prod only -> don't fire jobs (emails, ai) from dev servers
  if (process.env.NODE_ENV !== "production") return;

  const { startCronJobs } = await import("@/server/cron/scheduler");
  startCronJobs();
}
