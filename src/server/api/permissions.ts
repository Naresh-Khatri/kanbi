import { TRPCError } from "@trpc/server";
import { and, eq, gt, isNull, or } from "drizzle-orm";

import type { db as DB } from "@/server/db";
import {
	board,
	boardShare,
	project,
	projectMember,
	type projectRole,
} from "@/server/db/schema";

export type ProjectRole = (typeof projectRole.enumValues)[number];

export type BoardAccess = {
	actor: "user" | "public";
	userId: string | null;
	projectId: string;
	boardId: string;
	role: ProjectRole;
	canRead: true;
	canWrite: boolean;
	canAdmin: boolean;
};

const ROLE_RANK: Record<ProjectRole, number> = {
	viewer: 0,
	editor: 1,
	owner: 2,
};

export const roleCan = (role: ProjectRole, required: ProjectRole) =>
	ROLE_RANK[role] >= ROLE_RANK[required];

/** Resolve write access for a signed-in user on a given board. */
export async function resolveBoardAccess(args: {
	db: typeof DB;
	userId: string;
	boardId: string;
}): Promise<BoardAccess> {
	const row = await args.db
		.select({
			projectId: board.projectId,
			ownerId: project.ownerId,
			role: projectMember.role,
		})
		.from(board)
		.innerJoin(project, eq(project.id, board.projectId))
		.leftJoin(
			projectMember,
			and(
				eq(projectMember.projectId, board.projectId),
				eq(projectMember.userId, args.userId),
			),
		)
		.where(eq(board.id, args.boardId))
		.limit(1);

	const hit = row[0];
	if (!hit) throw new TRPCError({ code: "NOT_FOUND" });

	const isOwner = hit.ownerId === args.userId;
	const role: ProjectRole | null = isOwner ? "owner" : (hit.role ?? null);
	if (!role) throw new TRPCError({ code: "FORBIDDEN" });

	return {
		actor: "user",
		userId: args.userId,
		projectId: hit.projectId,
		boardId: args.boardId,
		role,
		canRead: true,
		canWrite: roleCan(role, "editor"),
		canAdmin: roleCan(role, "owner"),
	};
}

/** Resolve read-only access via a public share token. */
export async function resolvePublicBoardAccess(args: {
	db: typeof DB;
	boardId: string;
	shareToken: string;
}): Promise<BoardAccess> {
	const now = new Date();
	const row = await args.db
		.select({
			shareId: boardShare.id,
			projectId: board.projectId,
			maxUses: boardShare.maxUses,
			usesCount: boardShare.usesCount,
		})
		.from(boardShare)
		.innerJoin(board, eq(board.id, boardShare.boardId))
		.where(
			and(
				eq(boardShare.token, args.shareToken),
				eq(boardShare.boardId, args.boardId),
				isNull(boardShare.revokedAt),
				or(isNull(boardShare.expiresAt), gt(boardShare.expiresAt, now)),
			),
		)
		.limit(1);

	const hit = row[0];
	if (!hit) throw new TRPCError({ code: "FORBIDDEN" });

	if (hit.maxUses != null && hit.usesCount >= hit.maxUses) {
		throw new TRPCError({ code: "FORBIDDEN", message: "Share link exhausted" });
	}

	return {
		actor: "public",
		userId: null,
		projectId: hit.projectId,
		boardId: args.boardId,
		role: "viewer",
		canRead: true,
		canWrite: false,
		canAdmin: false,
	};
}

/** Resolve project-level access (no board required). */
export async function resolveProjectAccess(args: {
	db: typeof DB;
	userId: string;
	projectId: string;
}): Promise<{ role: ProjectRole; canWrite: boolean; canAdmin: boolean }> {
	const row = await args.db
		.select({ ownerId: project.ownerId, role: projectMember.role })
		.from(project)
		.leftJoin(
			projectMember,
			and(
				eq(projectMember.projectId, project.id),
				eq(projectMember.userId, args.userId),
			),
		)
		.where(eq(project.id, args.projectId))
		.limit(1);

	const hit = row[0];
	if (!hit) throw new TRPCError({ code: "NOT_FOUND" });

	const role: ProjectRole | null =
		hit.ownerId === args.userId ? "owner" : (hit.role ?? null);
	if (!role) throw new TRPCError({ code: "FORBIDDEN" });

	return {
		role,
		canWrite: roleCan(role, "editor"),
		canAdmin: roleCan(role, "owner"),
	};
}
