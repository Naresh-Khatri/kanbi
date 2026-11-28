import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

import { presignDownload } from "@/lib/r2";
import {
  resolveBoardAccess,
  resolveProjectAccess,
} from "@/server/api/permissions";
import { auth } from "@/server/better-auth";
import { db } from "@/server/db";
import { documentFile, task, taskAttachment } from "@/server/db/schema";

// rich text stores /api/files/<id>; presigned urls expire, so resolve per request
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const key = await resolveKey(id, session.user.id).catch(() => null);
  if (!key) return new Response("Not found", { status: 404 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: await presignDownload({ key }),
      // shorter than the 10 min presign so a cached redirect never points at an expired url
      "Cache-Control": "private, max-age=300",
    },
  });
}

// task attachment first, then doc image; access errors throw -> 404
async function resolveKey(id: string, userId: string) {
  const [attachment] = await db
    .select({ key: taskAttachment.key, boardId: task.boardId })
    .from(taskAttachment)
    .innerJoin(task, eq(task.id, taskAttachment.taskId))
    .where(eq(taskAttachment.id, id))
    .limit(1);
  if (attachment) {
    await resolveBoardAccess({ db, userId, boardId: attachment.boardId });
    return attachment.key;
  }
  const [file] = await db
    .select({ key: documentFile.key, projectId: documentFile.projectId })
    .from(documentFile)
    .where(eq(documentFile.id, id))
    .limit(1);
  if (!file) return null;
  await resolveProjectAccess({ db, userId, projectId: file.projectId });
  return file.key;
}
