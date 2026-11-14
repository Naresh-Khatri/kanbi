import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  buildAttachmentKey,
  deleteObject,
  MAX_ATTACHMENT_BYTES,
  headObject,
  presignDownload,
  presignUpload,
} from "@/lib/r2";
import { recordActivity } from "@/server/activity/record";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import { task, taskAttachment, user as userTable } from "@/server/db/schema";
import { bus } from "@/server/realtime/bus";

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
          commentId: taskAttachment.commentId,
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
        sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
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

  /** Registers an uploaded object. Size and type come from R2, not the client; safe to repeat. */
  create: boardProcedure
    .input(
      z.object({
        taskId: z.string().min(1),
        key: z.string().min(1).max(400),
        filename: z.string().trim().min(1).max(160),
        // pasted into a comment/description: the body shows it, so skip the activity row
        inline: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const [t] = await ctx.db
        .select({ boardId: task.boardId })
        .from(task)
        .where(eq(task.id, input.taskId))
        .limit(1);
      if (!t || t.boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (
        !input.key.startsWith(`attachments/${input.taskId}/`) ||
        input.key.includes("..")
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That upload key does not belong to this task.",
        });
      }

      const byKey = async () =>
        (
          await ctx.db
            .select()
            .from(taskAttachment)
            .where(eq(taskAttachment.key, input.key))
            .limit(1)
        )[0];
      const existing = await byKey();
      if (existing) return existing;

      const head = await headObject(input.key);
      if (!head || head.sizeBytes === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No uploaded file at that key yet. PUT the file first (the upload url expires).",
        });
      }
      if (head.sizeBytes > MAX_ATTACHMENT_BYTES) {
        // presigned PUT can't cap size; drop it so it doesn't linger
        await deleteObject(input.key).catch(() => undefined);
        throw new TRPCError({
          code: "PAYLOAD_TOO_LARGE",
          message: `File is larger than the ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB limit.`,
        });
      }

      const [row] = await ctx.db
        .insert(taskAttachment)
        .values({
          taskId: input.taskId,
          key: input.key,
          filename: input.filename,
          mime: head.contentType ?? "application/octet-stream",
          sizeBytes: head.sizeBytes,
          uploaderId: ctx.session.user.id,
          viaAgent: ctx.agent?.name ?? null,
        })
        .onConflictDoNothing()
        .returning();
      if (!row) {
        // lost a race with a concurrent register of the same key
        const raced = await byKey();
        if (!raced) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        return raced;
      }
      bus.emitBoard(input.boardId, {
        scope: "attachment",
        ids: [input.taskId],
      });
      if (!input.inline) {
        await recordActivity(ctx, {
          boardId: input.boardId,
          taskId: input.taskId,
          verb: "attachment.added",
          payload: { filename: row.filename },
        });
      }
      return row;
    }),

  remove: boardProcedure
    .input(z.object({ attachmentId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      const row = await ctx.db
        .select({
          id: taskAttachment.id,
          key: taskAttachment.key,
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
      await deleteObject(row[0].key).catch(() => undefined);
      bus.emitBoard(input.boardId, {
        scope: "attachment",
        ids: [input.attachmentId],
      });
    }),
});
