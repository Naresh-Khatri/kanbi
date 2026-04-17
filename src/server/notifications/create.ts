import type { db as Database } from "@/server/db";
import { notification } from "@/server/db/schema";
import { bus } from "@/server/realtime/bus";

export type NotificationType =
  | "task.assigned"
  | "task.unassigned"
  | "task.comment"
  | "task.mention"
  | "task.moved_to_done"
  | "task.due_soon"
  | "task.checklist_completed"
  | "project.invited"
  | "project.member_joined";

type CreateInput = {
  userId: string;
  actorId: string | null;
  type: NotificationType;
  projectId?: string | null;
  boardId?: string | null;
  taskId?: string | null;
  data?: Record<string, unknown>;
};

export async function createNotifications(
  db: typeof Database,
  inputs: CreateInput[],
) {
  const rows = inputs.filter((n) => n.userId && n.userId !== n.actorId);
  if (rows.length === 0) return;

  const inserted = await db
    .insert(notification)
    .values(
      rows.map((n) => ({
        userId: n.userId,
        actorId: n.actorId,
        type: n.type,
        projectId: n.projectId ?? null,
        boardId: n.boardId ?? null,
        taskId: n.taskId ?? null,
        data: n.data ?? {},
      })),
    )
    .returning({ id: notification.id, userId: notification.userId });

  const byUser = new Map<string, string[]>();
  for (const r of inserted) {
    const arr = byUser.get(r.userId) ?? [];
    arr.push(r.id);
    byUser.set(r.userId, arr);
  }
  for (const [userId, ids] of byUser) {
    bus.emitUser(userId, { scope: "notification", ids });
  }
}
