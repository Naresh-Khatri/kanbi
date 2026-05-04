import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { buildAttachmentKey, presignDownload, presignUpload } from "@/lib/r2";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { task, taskAttachment, user as userTable } from "@/server/db/schema";
import { bus } from "@/server/realtime/bus";

const MAX_BYTES = 25 * 1024 * 1024;

export const attachmentRouter = createTRPCRouter({
  list: boardProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const t = await ctx.db
        .select({ boardId: task.boardId })
        .from(task)
        .where(eq(task.id, input.taskId))
        .limit(1);
      if (!t[0] || t[0].boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const rows = await ctx.db
        .select({
          id: taskAttachment.id,
          key: taskAttachment.key,
          filename: taskAttachment.filename,
          mime: taskAttachment.mime,
          sizeBytes: taskAttachment.sizeBytes,
          createdAt: taskAttachment.createdAt,
          uploaderName: userTable.name,
        })
        .from(taskAttachment)
        .innerJoin(userTable, eq(userTable.id, taskAttachment.uploaderId))
        .where(eq(taskAttachment.taskId, input.taskId))
        .orderBy(desc(taskAttachment.createdAt));

      return Promise.all(
        rows.map(async (r) => ({
          ...r,
          url: await presignDownload({ key: r.key }),
        })),
      );
    }),

  createUploadUrl: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        filename: z.string().min(1).max(160),
        mime: z.string().min(1).max(100),
        sizeBytes: z.number().int().positive().max(MAX_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const t = await ctx.db
        .select({ boardId: task.boardId })
        .from(task)
        .where(eq(task.id, input.taskId))
        .limit(1);
      if (!t[0] || t[0].boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      const key = buildAttachmentKey({
        taskId: input.taskId,
        filename: input.filename,
      });
      const uploadUrl = await presignUpload({
        key,
        contentType: input.mime,
      });
      return { key, uploadUrl };
    }),

  create: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        key: z.string().min(1),
        filename: z.string().min(1).max(160),
        mime: z.string().min(1).max(100),
        sizeBytes: z.number().int().positive().max(MAX_BYTES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const [row] = await ctx.db
        .insert(taskAttachment)
        .values({
          taskId: input.taskId,
          key: input.key,
          filename: input.filename,
          mime: input.mime,
          sizeBytes: input.sizeBytes,
          uploaderId: ctx.session.user.id,
        })
        .returning();
      bus.emitBoard(input.boardId, {
        scope: "attachment",
        ids: [input.taskId],
      });
      return row;
    }),

  remove: boardProcedure
    .input(z.object({ attachmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const row = await ctx.db
        .select({
          id: taskAttachment.id,
          taskBoardId: task.boardId,
        })
        .from(taskAttachment)
        .innerJoin(task, eq(task.id, taskAttachment.taskId))
        .where(eq(taskAttachment.id, input.attachmentId))
        .limit(1);
      if (!row[0] || row[0].taskBoardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.db
        .delete(taskAttachment)
        .where(eq(taskAttachment.id, input.attachmentId));
      bus.emitBoard(input.boardId, {
        scope: "attachment",
        ids: [input.attachmentId],
      });
    }),
});
