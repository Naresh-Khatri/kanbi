import { TRPCError } from "@trpc/server";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { slugify, slugSuffix } from "@/lib/ids";
import {
	assertCanAdmin,
	createTRPCRouter,
	projectProcedure,
	protectedProcedure,
} from "@/server/api/trpc";
import {
	board,
	project,
	projectMember,
	user as userTable,
} from "@/server/db/schema";

export const projectRouter = createTRPCRouter({
	list: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;
		return ctx.db
			.selectDistinct({
				id: project.id,
				slug: project.slug,
				name: project.name,
				description: project.description,
				color: project.color,
				icon: project.icon,
				ownerId: project.ownerId,
				createdAt: project.createdAt,
				updatedAt: project.updatedAt,
			})
			.from(project)
			.leftJoin(projectMember, eq(projectMember.projectId, project.id))
			.where(or(eq(project.ownerId, userId), eq(projectMember.userId, userId)))
			.orderBy(desc(project.updatedAt));
	}),

	bySlug: protectedProcedure
		.input(z.object({ slug: z.string().min(1) }))
		.query(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const row = await ctx.db
				.select({
					id: project.id,
					slug: project.slug,
					name: project.name,
					description: project.description,
					color: project.color,
					icon: project.icon,
					ownerId: project.ownerId,
					boardId: board.id,
					role: projectMember.role,
				})
				.from(project)
				.innerJoin(board, eq(board.projectId, project.id))
				.leftJoin(
					projectMember,
					and(
						eq(projectMember.projectId, project.id),
						eq(projectMember.userId, userId),
					),
				)
				.where(eq(project.slug, input.slug))
				.limit(1);

			const hit = row[0];
			if (!hit) throw new TRPCError({ code: "NOT_FOUND" });
			if (hit.ownerId !== userId && !hit.role) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			return hit;
		}),

	create: protectedProcedure
		.input(
			z.object({
				name: z.string().min(1).max(80),
				description: z.string().max(500).optional(),
				color: z.string().optional(),
				icon: z.string().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const base = slugify(input.name) || "project";

			return ctx.db.transaction(async (tx) => {
				let slug = base;
				for (let i = 0; i < 5; i++) {
					const exists = await tx
						.select({ id: project.id })
						.from(project)
						.where(and(eq(project.ownerId, userId), eq(project.slug, slug)))
						.limit(1);
					if (exists.length === 0) break;
					slug = `${base}-${slugSuffix()}`;
				}

				const [row] = await tx
					.insert(project)
					.values({
						ownerId: userId,
						slug,
						name: input.name,
						description: input.description,
						color: input.color,
						icon: input.icon,
					})
					.returning();
				if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

				await tx.insert(board).values({ projectId: row.id });
				await tx.insert(projectMember).values({
					projectId: row.id,
					userId,
					role: "owner",
					acceptedAt: new Date(),
				});
				return row;
			});
		}),

	update: projectProcedure
		.input(
			z.object({
				name: z.string().min(1).max(80).optional(),
				description: z.string().max(500).nullable().optional(),
				color: z.string().nullable().optional(),
				icon: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!ctx.access.canWrite) throw new TRPCError({ code: "FORBIDDEN" });
			const { projectId, ...rest } = input;
			await ctx.db.update(project).set(rest).where(eq(project.id, projectId));
		}),

	delete: projectProcedure.mutation(async ({ ctx, input }) => {
		assertCanAdmin(ctx.access);
		await ctx.db.delete(project).where(eq(project.id, input.projectId));
	}),

	members: projectProcedure.query(async ({ ctx, input }) => {
		return ctx.db
			.select({
				userId: projectMember.userId,
				role: projectMember.role,
				acceptedAt: projectMember.acceptedAt,
				name: userTable.name,
				email: userTable.email,
				image: userTable.image,
			})
			.from(projectMember)
			.innerJoin(userTable, eq(userTable.id, projectMember.userId))
			.where(eq(projectMember.projectId, input.projectId));
	}),
});
