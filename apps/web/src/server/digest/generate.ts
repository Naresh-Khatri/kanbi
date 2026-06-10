import "server-only";

import { and, desc, eq, gte } from "drizzle-orm";

import { isDoneLikeColumn } from "@/lib/column-heuristics";
import {
  type DigestEvent,
  generateDigest,
  toDigestContent,
} from "@/server/ai/digest";
import type { db as Database } from "@/server/db";
import {
  activity,
  board,
  boardColumn,
  type DigestPerson,
  type DigestStats,
  digest,
  project,
  task,
  user as userTable,
} from "@/server/db/schema";

export const DIGEST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type StoredDigest = typeof digest.$inferSelect;

/**
 * Mine the last 7 days of a board's activity into an AI digest and persist it.
 * Returns null when there's no activity to summarize (caller decides whether
 * that's an error or just a skip). Shared by the tRPC mutation and the weekly
 * cron so both produce identical digests.
 */
export async function generateBoardDigest(
  db: typeof Database,
  boardId: string,
): Promise<StoredDigest | null> {
  const now = new Date();
  const since = new Date(now.getTime() - DIGEST_WINDOW_MS);

  const projectRow = await db
    .select({ name: project.name })
    .from(board)
    .innerJoin(project, eq(project.id, board.projectId))
    .where(eq(board.id, boardId))
    .limit(1);
  const boardName = projectRow[0]?.name ?? "this board";

  const columns = await db
    .select({ id: boardColumn.id, name: boardColumn.name })
    .from(boardColumn)
    .where(eq(boardColumn.boardId, boardId));
  const columnName = new Map(columns.map((c) => [c.id, c.name]));

  const rows = await db
    .select({
      verb: activity.verb,
      payload: activity.payload,
      createdAt: activity.createdAt,
      actorId: activity.actorId,
      actorName: userTable.name,
      taskTitle: task.title,
    })
    .from(activity)
    .innerJoin(userTable, eq(userTable.id, activity.actorId))
    .leftJoin(task, eq(task.id, activity.taskId))
    .where(and(eq(activity.boardId, boardId), gte(activity.createdAt, since)))
    .orderBy(desc(activity.createdAt));

  if (rows.length === 0) return null;

  const stats: DigestStats = {
    created: 0,
    updated: 0,
    moved: 0,
    completed: 0,
    comments: 0,
    contributors: 0,
  };
  const contributors = new Map<string, string>();
  const events: DigestEvent[] = [];

  for (const r of rows) {
    contributors.set(r.actorId, r.actorName);
    const payload = (r.payload ?? {}) as Record<string, unknown>;
    let detail: string | null = null;

    switch (r.verb) {
      case "task.created":
        stats.created += 1;
        break;
      case "task.updated": {
        stats.updated += 1;
        const fields = Array.isArray(payload.fields) ? payload.fields : [];
        if (fields.length > 0) detail = `changed ${fields.join(", ")}`;
        break;
      }
      case "task.moved": {
        stats.moved += 1;
        const to =
          typeof payload.toColumnId === "string"
            ? columnName.get(payload.toColumnId)
            : undefined;
        if (to) {
          detail = `→ ${to}`;
          if (isDoneLikeColumn(to)) stats.completed += 1;
        }
        break;
      }
      case "comment.created":
        stats.comments += 1;
        break;
    }

    events.push({
      at: r.createdAt,
      actor: r.actorName,
      verb: r.verb,
      taskTitle: r.taskTitle,
      detail,
    });
  }
  stats.contributors = contributors.size;
  const people: DigestPerson[] = [...contributors]
    .slice(0, 12)
    .map(([id, name]) => ({ id, name }));

  const draft = await generateDigest({
    boardName,
    periodLabel: "the past 7 days",
    stats,
    events,
  });

  const inserted = await db
    .insert(digest)
    .values({
      boardId,
      periodStart: since,
      periodEnd: now,
      content: toDigestContent(draft, stats, people),
    })
    .returning();

  return inserted[0]!;
}
