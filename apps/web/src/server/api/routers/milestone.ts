import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { isResolvedCategory, milestoneProgress } from "@/lib/milestone";
import { positionAtEnd, positionBetween } from "@/lib/position";
import { recordActivity } from "@/server/activity/record";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import type { db as Database } from "@/server/db";
import {
  board,
  boardColumn,
  milestone,
  project,
  task,
} from "@/server/db/schema";
import { writeMilestoneSummary } from "@/server/milestones/summary";
import { bus } from "@/server/realtime/bus";

const nameSchema = z.string().trim().min(1).max(80);
const descriptionSchema = z.string().trim().max(2_000).nullable();
const openStatus = z.enum(["upcoming", "active"]);

/** Throws unless the milestone is on this board and still open. */
export async function assertOpenMilestone(
  db: typeof Database,
  boardId: string,
  milestoneId: string,
) {
  const [row] = await db
    .select({
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
    })
    .from(milestone)
    .where(and(eq(milestone.id, milestoneId), eq(milestone.boardId, boardId)))
    .limit(1);
  if (!row) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Milestone not found." });
  }
  if (row.status === "closed") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Milestone "${row.name}" is closed.`,
    });
  }
  return row;
}

export const milestoneRouter = createTRPCRouter({
  /** Milestones in board order; progress skips archived tasks unless closed. */
  list: boardProcedure
    .input(z.object({ includeClosed: z.boolean().default(true) }))
    .query(async ({ ctx, input }) => {
      const [rows, columns, tasks] = await Promise.all([
        ctx.db
          .select()
          .from(milestone)
          .where(eq(milestone.boardId, input.boardId))
          .orderBy(asc(milestone.position)),
        ctx.db
          .select({ id: boardColumn.id, category: boardColumn.category })
          .from(boardColumn)
          .where(eq(boardColumn.boardId, input.boardId)),
        ctx.db
          .select({
            milestoneId: task.milestoneId,
            columnId: task.columnId,
            archivedAt: task.archivedAt,
          })
          .from(task)
          .where(eq(task.boardId, input.boardId)),
      ]);
      const categories = new Map(columns.map((c) => [c.id, c.category]));
      return rows
        .filter((m) => input.includeClosed || m.status !== "closed")
        .map((m) => {
          // close-dialog counts; unlike progress, canceled = finished
          let finished = 0;
          let unfinished = 0;
          for (const t of tasks) {
            if (t.milestoneId !== m.id || t.archivedAt) continue;
            if (isResolvedCategory(categories.get(t.columnId))) finished += 1;
            else unfinished += 1;
          }
          return {
            ...m,
            progress: milestoneProgress(
              tasks,
              categories,
              m.id,
              m.status === "closed",
            ),
            finished,
            unfinished,
          };
        });
    }),

  create: boardProcedure
    .input(
      z.object({
        name: nameSchema,
        description: descriptionSchema.optional(),
        targetAt: z.date().nullable().optional(),
        status: openStatus.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const existing = await ctx.db
        .select({ position: milestone.position })
        .from(milestone)
        .where(eq(milestone.boardId, input.boardId))
        .orderBy(asc(milestone.position));
      const [row] = await ctx.db
        .insert(milestone)
        .values({
          boardId: input.boardId,
          name: input.name,
          description: input.description || null,
          targetAt: input.targetAt ?? null,
          status: input.status ?? "upcoming",
          position: positionAtEnd(existing),
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      bus.emitBoard(input.boardId, { scope: "milestone", ids: [row.id] });
      return row;
    }),

  update: boardProcedure
    .input(
      z.object({
        milestoneId: z.string().min(1),
        name: nameSchema.optional(),
        description: descriptionSchema.optional(),
        targetAt: z.date().nullable().optional(),
        // closed -> active/upcoming reopens it
        status: openStatus.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const { milestoneId, boardId, ...rest } = input;
      const [row] = await ctx.db
        .update(milestone)
        .set({
          ...rest,
          ...(rest.description !== undefined
            ? { description: rest.description || null }
            : {}),
          ...(rest.status ? { closedAt: null } : {}),
        })
        .where(
          and(eq(milestone.id, milestoneId), eq(milestone.boardId, boardId)),
        )
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      bus.emitBoard(boardId, { scope: "milestone", ids: [milestoneId] });
      return row;
    }),

  reorder: boardProcedure
    .input(
      z.object({
        milestoneId: z.string().min(1),
        before: z.number().nullable(),
        after: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(milestone)
        .set({ position: positionBetween(input.before, input.after) })
        .where(
          and(
            eq(milestone.id, input.milestoneId),
            eq(milestone.boardId, input.boardId),
          ),
        );
      bus.emitBoard(input.boardId, {
        scope: "milestone",
        ids: [input.milestoneId],
      });
    }),

  /** Tasks keep existing; FK sets their milestone to null. */
  delete: boardProcedure
    .input(z.object({ milestoneId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .delete(milestone)
        .where(
          and(
            eq(milestone.id, input.milestoneId),
            eq(milestone.boardId, input.boardId),
          ),
        );
      bus.emitBoard(input.boardId, {
        scope: "milestone",
        ids: [input.milestoneId],
      });
    }),

  /**
   * Finished (completed/canceled) tasks get archived, the rest move to
   * `moveUnfinishedTo` (another open milestone, or null = none).
   */
  close: boardProcedure
    .input(
      z.object({
        milestoneId: z.string().min(1),
        moveUnfinishedTo: z.string().min(1).nullable().default(null),
        archiveFinished: z.boolean().default(true),
        writeSummary: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const target = await assertOpenMilestone(
        ctx.db,
        input.boardId,
        input.milestoneId,
      );
      const carriedTo =
        input.moveUnfinishedTo && input.moveUnfinishedTo !== input.milestoneId
          ? await assertOpenMilestone(
              ctx.db,
              input.boardId,
              input.moveUnfinishedTo,
            )
          : null;

      const rows = await ctx.db
        .select({
          id: task.id,
          number: task.number,
          title: task.title,
          category: boardColumn.category,
        })
        .from(task)
        .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
        .where(
          and(
            eq(task.boardId, input.boardId),
            eq(task.milestoneId, input.milestoneId),
            isNull(task.archivedAt),
          ),
        )
        .orderBy(asc(task.number));
      const finished = rows.filter((r) => isResolvedCategory(r.category));
      const unfinished = rows.filter((r) => !isResolvedCategory(r.category));
      const now = new Date();

      const [meta] = await ctx.db
        .select({
          description: milestone.description,
          projectId: project.id,
          projectKey: project.key,
        })
        .from(milestone)
        .innerJoin(board, eq(board.id, milestone.boardId))
        .innerJoin(project, eq(project.id, board.projectId))
        .where(eq(milestone.id, input.milestoneId))
        .limit(1);

      await ctx.db.transaction(async (tx) => {
        if (input.archiveFinished && finished.length > 0) {
          await tx
            .update(task)
            .set({ archivedAt: now })
            .where(
              inArray(
                task.id,
                finished.map((r) => r.id),
              ),
            );
        }
        if (unfinished.length > 0) {
          await tx
            .update(task)
            .set({ milestoneId: carriedTo?.id ?? null })
            .where(
              inArray(
                task.id,
                unfinished.map((r) => r.id),
              ),
            );
        }
        await tx
          .update(milestone)
          .set({ status: "closed", closedAt: now })
          .where(eq(milestone.id, input.milestoneId));
      });

      bus.emitBoard(input.boardId, {
        scope: "task",
        ids: rows.map((r) => r.id),
      });
      bus.emitBoard(input.boardId, {
        scope: "milestone",
        ids: [input.milestoneId],
      });
      await recordActivity(ctx, {
        boardId: input.boardId,
        verb: "milestone.closed",
        payload: {
          milestoneId: input.milestoneId,
          name: target.name,
          finished: finished.length,
          carried: unfinished.length,
          carriedTo: carriedTo?.name ?? null,
        },
      });

      let documentId: string | null = null;
      if (input.writeSummary && meta) {
        documentId = await writeMilestoneSummary(ctx.db, {
          projectId: meta.projectId,
          projectKey: meta.projectKey,
          userId: ctx.session.user.id,
          milestone: target.name,
          description: meta.description,
          finished,
          unfinished,
          carriedTo: carriedTo?.name ?? null,
        });
      }

      return {
        archived: input.archiveFinished ? finished.length : 0,
        finished: finished.length,
        carried: unfinished.length,
        carriedTo: carriedTo
          ? { id: carriedTo.id, name: carriedTo.name }
          : null,
        documentId,
      };
    }),
});
