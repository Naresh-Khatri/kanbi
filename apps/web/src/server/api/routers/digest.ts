import { and, desc, eq, gte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  type DigestEvent,
  generateDigest,
  toDigestContent,
} from "@/server/ai/digest";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import {
  activity,
  board,
  boardColumn,
  type DigestStats,
  digest,
  project,
  task,
  user as userTable,
} from "@/server/db/schema";
import { isDoneLikeColumn } from "@/lib/column-heuristics";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const digestRouter = createTRPCRouter({
  /** Latest stored digest for the board, or null if none generated yet. */
  latest: boardProcedure.query(async ({ ctx, input }) => {
    const rows = await ctx.db
      .select()
      .from(digest)
      .where(eq(digest.boardId, input.boardId))
      .orderBy(desc(digest.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }),

  /** Mine the last 7 days of activity and write a fresh AI digest. */
  generate: boardProcedure.mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.access);

    const now = new Date();
    const since = new Date(now.getTime() - WINDOW_MS);

    const projectRow = await ctx.db
      .select({ name: project.name })
      .from(board)
      .innerJoin(project, eq(project.id, board.projectId))
      .where(eq(board.id, input.boardId))
      .limit(1);
    const boardName = projectRow[0]?.name ?? "this board";

    const columns = await ctx.db
      .select({ id: boardColumn.id, name: boardColumn.name })
      .from(boardColumn)
      .where(eq(boardColumn.boardId, input.boardId));
    const columnName = new Map(columns.map((c) => [c.id, c.name]));

    const rows = await ctx.db
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
      .where(
        and(
          eq(activity.boardId, input.boardId),
          gte(activity.createdAt, since),
        ),
      )
      .orderBy(desc(activity.createdAt));

    if (rows.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No activity in the last 7 days to summarize.",
      });
    }

    const stats: DigestStats = {
      created: 0,
      updated: 0,
      moved: 0,
      completed: 0,
      comments: 0,
      contributors: 0,
    };
    const contributors = new Set<string>();
    const events: DigestEvent[] = [];

    for (const r of rows) {
      contributors.add(r.actorId);
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

    const draft = await generateDigest({
      boardName,
      periodLabel: "the past 7 days",
      stats,
      events,
    });

    const inserted = await ctx.db
      .insert(digest)
      .values({
        boardId: input.boardId,
        periodStart: since,
        periodEnd: now,
        content: toDigestContent(draft, stats),
      })
      .returning();

    return inserted[0]!;
  }),
});
