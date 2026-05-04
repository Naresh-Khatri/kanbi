import { and, between, eq, inArray, isNotNull, isNull } from "drizzle-orm";

import type { db as Database } from "@/server/db";
import { notification, task } from "@/server/db/schema";
import { createNotifications } from "@/server/notifications/create";

const LOOKAHEAD_MS = 24 * 60 * 60 * 1000;

export async function runDueReminders(db: typeof Database) {
  const now = new Date();
  const until = new Date(now.getTime() + LOOKAHEAD_MS);

  const candidates = await db
    .select({
      id: task.id,
      title: task.title,
      boardId: task.boardId,
      assigneeId: task.assigneeId,
      dueAt: task.dueAt,
    })
    .from(task)
    .where(
      and(
        isNotNull(task.assigneeId),
        isNull(task.archivedAt),
        between(task.dueAt, now, until),
      ),
    );

  if (candidates.length === 0) return { notified: 0 };

  const taskIds = candidates.map((c) => c.id);
  const existing = await db
    .select({ userId: notification.userId, taskId: notification.taskId })
    .from(notification)
    .where(
      and(
        eq(notification.type, "task.due_soon"),
        inArray(notification.taskId, taskIds),
      ),
    );

  const seen = new Set(existing.map((r) => `${r.userId}:${r.taskId}`));

  const payload: Parameters<typeof createNotifications>[1] = [];
  for (const c of candidates) {
    if (!c.assigneeId || !c.dueAt) continue;
    if (seen.has(`${c.assigneeId}:${c.id}`)) continue;
    payload.push({
      userId: c.assigneeId,
      actorId: null,
      type: "task.due_soon",
      boardId: c.boardId,
      taskId: c.id,
      data: { title: c.title, dueAt: c.dueAt.toISOString() },
    });
  }

  if (payload.length > 0) await createNotifications(db, payload);
  return { notified: payload.length };
}
