import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { positionAtEnd } from "@/lib/position";
import {
	assertCanWrite,
	boardProcedure,
	createTRPCRouter,
} from "@/server/api/trpc";
import type { db as Db } from "@/server/db";
import { checklistItem, task } from "@/server/db/schema";

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

export const checklistRouter = createTRPCRouter({
	list: boardProcedure
		.input(z.object({ taskId: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			await assertTaskOnBoard(ctx.db, input.taskId, input.boardId);
			return ctx.db
				.select()
				.from(checklistItem)
				.where(eq(checklistItem.taskId, input.taskId))
				.orderBy(asc(checklistItem.position));
		}),

	add: boardProcedure
		.input(
			z.object({
				taskId: z.string().min(1),
				text: z.string().min(1).max(280),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			await assertTaskOnBoard(ctx.db, input.taskId, input.boardId);
			const existing = await ctx.db
				.select({ position: checklistItem.position })
				.from(checklistItem)
				.where(eq(checklistItem.taskId, input.taskId))
				.orderBy(asc(checklistItem.position));
			const [row] = await ctx.db
				.insert(checklistItem)
				.values({
					taskId: input.taskId,
					text: input.text,
					position: positionAtEnd(existing),
				})
				.returning();
			return row;
		}),

	toggle: boardProcedure
		.input(z.object({ itemId: z.string().min(1), done: z.boolean() }))
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			await ctx.db
				.update(checklistItem)
				.set({ done: input.done })
				.where(eq(checklistItem.id, input.itemId));
		}),

	rename: boardProcedure
		.input(
			z.object({
				itemId: z.string().min(1),
				text: z.string().min(1).max(280),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			await ctx.db
				.update(checklistItem)
				.set({ text: input.text })
				.where(eq(checklistItem.id, input.itemId));
		}),

	remove: boardProcedure
		.input(z.object({ itemId: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			assertCanWrite(ctx.access);
			await ctx.db
				.delete(checklistItem)
				.where(eq(checklistItem.id, input.itemId));
		}),
});
