import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
	assertCanWrite,
	boardProcedure,
	createTRPCRouter,
} from "@/server/api/trpc";
import { comment, task, user as userTable } from "@/server/db/schema";

async function assertTaskOnBoard(
	db: { select: (...a: unknown[]) => unknown },
	taskId: string,
	boardId: string,
) {
	const row = await (db as typeof import("@/server/db").db)
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
			return ctx.db
				.select({
					id: comment.id,
					taskId: comment.taskId,
					authorId: comment.authorId,
					body: comment.body,
					createdAt: comment.createdAt,
					editedAt: comment.editedAt,
					authorName: userTable.name,
					authorImage: userTable.image,
				})
				.from(comment)
				.innerJoin(userTable, eq(userTable.id, comment.authorId))
				.where(eq(comment.taskId, input.taskId))
				.orderBy(asc(comment.createdAt));
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
			const [row] = await ctx.db
				.insert(comment)
				.values({
					taskId: input.taskId,
					authorId: ctx.session.user.id,
					body: input.body,
				})
				.returning();
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
			await ctx.db
				.update(comment)
				.set({ body: input.body, editedAt: new Date() })
				.where(
					and(
						eq(comment.id, input.commentId),
						eq(comment.authorId, ctx.session.user.id),
					),
				);
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
		}),
});
