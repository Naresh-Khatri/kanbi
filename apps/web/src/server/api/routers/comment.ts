import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import { z } from "zod";

import { extractFileIds } from "@/lib/file-url";
import { discloseComment } from "@/server/activity/disclosure";
import { recordActivity } from "@/server/activity/record";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import type { db as Db } from "@/server/db";
import {
  comment,
  task,
  taskAttachment,
  user as userTable,
} from "@/server/db/schema";
import { createNotifications } from "@/server/notifications/create";
import { resolveMentions } from "@/server/notifications/mentions";
import { bus } from "@/server/realtime/bus";
import { sanitizeRichText } from "@/server/rich-text/sanitize";

function cleanBody(body: string) {
  const html = sanitizeRichText(body);
  if (!html.replace(/<(?!img\b)[^>]*>/g, "").trim()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Comment is empty." });
  }
  return html;
}

/** Inline images belong to the comment that shows them; edits that drop one release it. */
async function linkCommentImages(
  db: typeof Db,
  taskId: string,
  commentId: string,
  html: string,
) {
  const ids = extractFileIds(html);
  await db
    .update(taskAttachment)
    .set({ commentId: null })
    .where(
      and(
        eq(taskAttachment.commentId, commentId),
        ids.length > 0 ? notInArray(taskAttachment.id, ids) : undefined,
      ),
    );
  if (ids.length === 0) return;
  await db
    .update(taskAttachment)
    .set({ commentId })
    .where(
      and(
        eq(taskAttachment.taskId, taskId),
        inArray(taskAttachment.id, ids),
        isNull(taskAttachment.commentId),
      ),
    );
}

async function assertTaskOnBoard(
  db: typeof Db,
  taskId: string,
  boardId: string,
) {
  const row = await db
    .select({ boardId: task.boardId })
    .from(task)
    .where(eq(task.id, taskId))
    .limit(1);
  if (!row[0] || row[0].boardId !== boardId) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }
}

export const commentRouter = createTRPCRouter({
  list: boardProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await assertTaskOnBoard(ctx.db, input.taskId, input.boardId);
      const rows = await ctx.db
        .select({
          id: comment.id,
          taskId: comment.taskId,
          authorId: comment.authorId,
          body: comment.body,
          agent: comment.agent,
          createdAt: comment.createdAt,
          editedAt: comment.editedAt,
          authorName: userTable.name,
          authorImage: userTable.image,
        })
        .from(comment)
        .innerJoin(userTable, eq(userTable.id, comment.authorId))
        .where(eq(comment.taskId, input.taskId))
        .orderBy(asc(comment.createdAt));
      return rows.map((r) => discloseComment(ctx.access, r));
    }),

  create: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        body: z.string().min(1).max(10_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await assertTaskOnBoard(ctx.db, input.taskId, input.boardId);
      const body = cleanBody(input.body);
      const [row] = await ctx.db
        .insert(comment)
        .values({
          taskId: input.taskId,
          authorId: ctx.session.user.id,
          body,
          agent: ctx.agent?.kind ?? null,
          agentClientId: ctx.agent?.clientId ?? null,
        })
        .returning();
      if (row) await linkCommentImages(ctx.db, input.taskId, row.id, body);
      bus.emitBoard(input.boardId, { scope: "comment", ids: [input.taskId] });
      await recordActivity(ctx, {
        boardId: input.boardId,
        taskId: input.taskId,
        verb: "comment.created",
      });

      const taskRows = await ctx.db
        .select({
          title: task.title,
          reporterId: task.reporterId,
          assigneeId: task.assigneeId,
        })
        .from(task)
        .where(eq(task.id, input.taskId))
        .limit(1);
      const t = taskRows[0];
      if (t) {
        const mentioned = new Set(
          await resolveMentions(ctx.db, input.boardId, body),
        );
        mentioned.delete(ctx.session.user.id);

        const recipients = new Set<string>();
        if (t.reporterId) recipients.add(t.reporterId);
        if (t.assigneeId) recipients.add(t.assigneeId);
        recipients.delete(ctx.session.user.id);
        for (const id of mentioned) recipients.delete(id);

        const excerpt = body.slice(0, 200);
        const payload: Parameters<typeof createNotifications>[1] = [];
        for (const userId of mentioned) {
          payload.push({
            userId,
            actorId: ctx.session.user.id,
            type: "task.mention",
            boardId: input.boardId,
            taskId: input.taskId,
            data: { title: t.title, excerpt },
          });
        }
        for (const userId of recipients) {
          payload.push({
            userId,
            actorId: ctx.session.user.id,
            type: "task.comment",
            boardId: input.boardId,
            taskId: input.taskId,
            data: { title: t.title, excerpt },
          });
        }
        if (payload.length > 0) await createNotifications(ctx.db, payload);
      }

      return row;
    }),

  edit: boardProcedure
    .input(
      z.object({
        commentId: z.string().min(1),
        body: z.string().min(1).max(10_000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const body = cleanBody(input.body);
      const [row] = await ctx.db
        .update(comment)
        // a person editing an agent's note keeps its badge
        .set({
          body,
          editedAt: new Date(),
          ...(ctx.agent
            ? { agent: ctx.agent.kind, agentClientId: ctx.agent.clientId }
            : {}),
        })
        .where(
          and(
            eq(comment.id, input.commentId),
            eq(comment.authorId, ctx.session.user.id),
          ),
        )
        .returning({ taskId: comment.taskId });
      if (row)
        await linkCommentImages(ctx.db, row.taskId, input.commentId, body);
      bus.emitBoard(input.boardId, {
        scope: "comment",
        ids: [input.commentId],
      });
    }),

  delete: boardProcedure
    .input(z.object({ commentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .delete(comment)
        .where(
          and(
            eq(comment.id, input.commentId),
            eq(comment.authorId, ctx.session.user.id),
          ),
        );
      bus.emitBoard(input.boardId, {
        scope: "comment",
        ids: [input.commentId],
      });
    }),
});
