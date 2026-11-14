import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { presignDownload } from "@/lib/r2";
import { resolveBoardAccess } from "@/server/api/permissions";
import { auth } from "@/server/better-auth";
import { db } from "@/server/db";
import { task, taskAttachment } from "@/server/db/schema";

// rich text stores /api/files/<id>; presigned urls expire, so resolve per request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const [row] = await db
    .select({ key: taskAttachment.key, boardId: task.boardId })
    .from(taskAttachment)
    .innerJoin(task, eq(task.id, taskAttachment.taskId))
    .where(eq(taskAttachment.id, id))
    .limit(1);
  if (!row) return new Response("Not found", { status: 404 });

  try {
    await resolveBoardAccess({
      db,
      userId: session.user.id,
      boardId: row.boardId,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: await presignDownload({ key: row.key }),
      // shorter than the 10 min presign so a cached redirect never points at an expired url
      "Cache-Control": "private, max-age=300",
    },
  });
}
