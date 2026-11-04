import "server-only";

import { and, eq } from "drizzle-orm";

import type { db as DB } from "@/server/db";
import {
  project,
  projectInvite,
  projectMember,
  user as userTable,
} from "@/server/db/schema";

export type InviteStatus = "valid" | "expired" | "used";

export type InvitePreview = NonNullable<Awaited<ReturnType<typeof loadInvite>>>;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const sameEmail = (a: string, b: string) =>
  normalizeEmail(a) === normalizeEmail(b);

export async function loadInvite(db: typeof DB, token: string) {
  const [row] = await db
    .select({
      id: projectInvite.id,
      email: projectInvite.email,
      role: projectInvite.role,
      expiresAt: projectInvite.expiresAt,
      acceptedAt: projectInvite.acceptedAt,
      invitedById: projectInvite.invitedById,
      projectId: project.id,
      projectName: project.name,
      projectSlug: project.slug,
      projectColor: project.color,
      ownerId: project.ownerId,
      inviterName: userTable.name,
      inviterImage: userTable.image,
    })
    .from(projectInvite)
    .innerJoin(project, eq(project.id, projectInvite.projectId))
    .innerJoin(userTable, eq(userTable.id, projectInvite.invitedById))
    .where(eq(projectInvite.token, token))
    .limit(1);
  if (!row) return null;

  const status: InviteStatus = row.acceptedAt
    ? "used"
    : row.expiresAt && row.expiresAt < new Date()
      ? "expired"
      : "valid";
  return { ...row, status };
}

/** true when the user already owns or belongs to the project. */
export async function hasProjectAccess(
  db: typeof DB,
  args: { projectId: string; ownerId: string; userId: string },
) {
  if (args.ownerId === args.userId) return true;
  const [m] = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .where(
      and(
        eq(projectMember.projectId, args.projectId),
        eq(projectMember.userId, args.userId),
      ),
    )
    .limit(1);
  return !!m;
}

export async function accountExists(db: typeof DB, email: string) {
  const [u] = await db
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.email, normalizeEmail(email)))
    .limit(1);
  return !!u;
}

/** invite banner for /login + /signup; only for a still-valid token. no ids leak. */
export async function resolveAuthInvite(
  db: typeof DB,
  token: string | undefined,
) {
  if (!token) return null;
  const inv = await loadInvite(db, token);
  if (inv?.status !== "valid") return null;
  return {
    token,
    email: inv.email,
    projectName: inv.projectName,
    projectColor: inv.projectColor,
    inviterName: inv.inviterName,
    inviterImage: inv.inviterImage,
  };
}

export type AuthInvite = NonNullable<
  Awaited<ReturnType<typeof resolveAuthInvite>>
>;
