import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
	assertCanWrite,
	boardProcedure,
	createTRPCRouter,
} from "@/server/api/trpc";
import { label, task, taskLabel } from "@/server/db/schema";

export const labelRouter = createTRPCRouter({
	create: boardProcedure
		.input(
			z.object({
				name: z.string().min(1).max(40),
				color: z.string().min(1).max(20),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			const [row] = await ctx.db
				.insert(label)
				.values({
					boardId: input.boardId,
					name: input.name,
					color: input.color,
				})
				.returning();
			return row;
		}),

	update: boardProcedure
		.input(
			z.object({
				labelId: z.string().min(1),
				name: z.string().min(1).max(40).optional(),
				color: z.string().min(1).max(20).optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			const { labelId, name, color } = input;
			await ctx.db
				.update(label)
				.set({ name, color })
				.where(and(eq(label.id, labelId), eq(label.boardId, input.boardId)));
		}),

	delete: boardProcedure
		.input(z.object({ labelId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			await ctx.db
				.delete(label)
				.where(
					and(eq(label.id, input.labelId), eq(label.boardId, input.boardId)),
				);
		}),

	setOnTask: boardProcedure
		.input(
			z.object({
				taskId: z.string().min(1),
				labelId: z.string().min(1),
				on: z.boolean(),
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

			if (input.on) {
				await ctx.db
					.insert(taskLabel)
					.values({ taskId: input.taskId, labelId: input.labelId })
					.onConflictDoNothing();
			} else {
				await ctx.db
					.delete(taskLabel)
					.where(
						and(
							eq(taskLabel.taskId, input.taskId),
							eq(taskLabel.labelId, input.labelId),
						),
					);
			}
		}),
});
