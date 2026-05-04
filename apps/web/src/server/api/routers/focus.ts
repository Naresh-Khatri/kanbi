import { TRPCError } from "@trpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { resolveBoardAccess } from "@/server/api/permissions";
import {
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  board,
  boardColumn,
  project,
  projectMember,
  task,
} from "@/server/db/schema";

/**
 * Endpoints for the kanbi-focus Expo client. Authenticates via either a
 * cookie session (web preview) or `Authorization: Bearer kbf_…` from a
 * paired device. All reads use the same per-project ACL as the web app.
 */
export const focusRouter = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.session.user.id,
    name: ctx.session.user.name,
    email: ctx.session.user.email,
    image: ctx.session.user.image ?? null,
    via: ctx.device ? ("device" as const) : ("session" as const),
  })),

  listBoards: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const projectFields = {
      boardId: board.id,
      projectId: project.id,
      projectName: project.name,
      projectSlug: project.slug,
      projectIcon: project.icon,
      projectColor: project.color,
    };

    const [owned, member] = await Promise.all([
      ctx.db
        .select(projectFields)
        .from(board)
        .innerJoin(project, eq(project.id, board.projectId))
        .where(eq(project.ownerId, userId)),
      ctx.db
        .select(projectFields)
        .from(board)
        .innerJoin(project, eq(project.id, board.projectId))
        .innerJoin(
          projectMember,
          and(
            eq(projectMember.projectId, project.id),
            eq(projectMember.userId, userId),
          ),
        ),
    ]);

    const seen = new Set<string>();
    const merged = [...owned, ...member]
      .filter((row) => {
        if (seen.has(row.boardId)) return false;
        seen.add(row.boardId);
        return true;
      })
      .map((row) => ({
        boardId: row.boardId,
        project: {
          id: row.projectId,
          name: row.projectName,
          slug: row.projectSlug,
          icon: row.projectIcon,
          color: row.projectColor,
        },
      }));

    return merged;
  }),

  boardSnapshot: protectedProcedure
    .input(z.object({ boardId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Permission check piggybacks on the same helper the web app uses.
      const access = await resolveBoardAccess({
        db: ctx.db,
        userId: ctx.session.user.id,
        boardId: input.boardId,
      });

      const [boardRow] = await ctx.db
        .select({
          id: board.id,
          projectId: project.id,
          projectName: project.name,
          projectSlug: project.slug,
        })
        .from(board)
        .innerJoin(project, eq(project.id, board.projectId))
        .where(eq(board.id, access.boardId))
        .limit(1);
      if (!boardRow) throw new TRPCError({ code: "NOT_FOUND" });

      const [columns, tasks] = await Promise.all([
        ctx.db
          .select({
            id: boardColumn.id,
            name: boardColumn.name,
            position: boardColumn.position,
          })
          .from(boardColumn)
          .where(eq(boardColumn.boardId, access.boardId))
          .orderBy(asc(boardColumn.position)),
        ctx.db
          .select({
            id: task.id,
            title: task.title,
            columnId: task.columnId,
            priority: task.priority,
            position: task.position,
            dueAt: task.dueAt,
            assigneeId: task.assigneeId,
          })
          .from(task)
          .where(
            and(eq(task.boardId, access.boardId), isNull(task.archivedAt)),
          )
          .orderBy(asc(task.position)),
      ]);

      return {
        board: {
          id: boardRow.id,
          projectId: boardRow.projectId,
          projectName: boardRow.projectName,
          projectSlug: boardRow.projectSlug,
        },
        columns,
        tasks,
        fetchedAt: new Date(),
      };
    }),
});
