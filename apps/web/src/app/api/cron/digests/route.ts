import { NextResponse } from "next/server";

import { env } from "@/env";
import { db } from "@/server/db";
import { runWeeklyDigests } from "@/server/notifications/weekly-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// AI generation per board can take a while — give the run room.
export const maxDuration = 300;

async function handle(req: Request) {
  const secret = env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const header = req.headers.get("authorization");
  if (header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runWeeklyDigests(db);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
