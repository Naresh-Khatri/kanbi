import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { positionAtEnd, positionBetween } from "@/lib/position";
import {
	assertCanWrite,
	boardProcedure,
	createTRPCRouter,
} from "@/server/api/trpc";
import { boardColumn, task, taskPriority } from "@/server/db/schema";

const priorityEnum = z.enum(taskPriority.enumValues);

export const taskRouter = createTRPCRouter({
	create: boardProcedure
		.input(
			z.object({
				columnId: z.string().min(1),
				title: z.string().min(1).max(200),
				description: z.string().max(10_000).optional(),
				priority: priorityEnum.optional(),
				assigneeId: z.string().nullable().optional(),
				dueAt: z.date().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);

			const col = await ctx.db
				.select({ id: boardColumn.id, boardId: boardColumn.boardId })
				.from(boardColumn)
				.where(eq(boardColumn.id, input.columnId))
				.limit(1);
			if (!col[0] || col[0].boardId !== input.boardId) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}

			const existing = await ctx.db
				.select({ position: task.position })
				.from(task)
				.where(eq(task.columnId, input.columnId))
				.orderBy(asc(task.position));

			const [row] = await ctx.db
				.insert(task)
				.values({
					boardId: input.boardId,
					columnId: input.columnId,
					title: input.title,
					description: input.description,
					priority: input.priority ?? "none",
					position: positionAtEnd(existing),
					reporterId: ctx.session.user.id,
					assigneeId: input.assigneeId ?? null,
					dueAt: input.dueAt ?? null,
				})
				.returning();
			return row;
		}),

	update: boardProcedure
		.input(
			z.object({
				taskId: z.string().min(1),
				title: z.string().min(1).max(200).optional(),
				description: z.string().max(10_000).nullable().optional(),
				priority: priorityEnum.optional(),
				assigneeId: z.string().nullable().optional(),
				dueAt: z.date().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			const { taskId, boardId, ...rest } = input;
			await ctx.db
				.update(task)
				.set(rest)
				.where(and(eq(task.id, taskId), eq(task.boardId, boardId)));
		}),

	delete: boardProcedure
		.input(z.object({ taskId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			await ctx.db
				.delete(task)
				.where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
		}),

	move: boardProcedure
		.input(
			z.object({
				taskId: z.string().min(1),
				toColumnId: z.string().min(1),
				before: z.number().nullable(),
				after: z.number().nullable(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			const col = await ctx.db
				.select({ boardId: boardColumn.boardId })
				.from(boardColumn)
				.where(eq(boardColumn.id, input.toColumnId))
				.limit(1);
			if (!col[0] || col[0].boardId !== input.boardId) {
				throw new TRPCError({ code: "NOT_FOUND" });
			}
			await ctx.db
				.update(task)
				.set({
					columnId: input.toColumnId,
					position: positionBetween(input.before, input.after),
				})
				.where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
		}),

	archive: boardProcedure
		.input(z.object({ taskId: z.string().min(1), archived: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			await ctx.db
				.update(task)
				.set({ archivedAt: input.archived ? new Date() : null })
				.where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
		}),
});
