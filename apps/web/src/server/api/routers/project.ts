import { TRPCError } from "@trpc/server";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import {
  deriveProjectKey,
  normalizeProjectKey,
  shareToken,
  slugify,
  slugSuffix,
} from "@/lib/ids";
import {
  assertCanAdmin,
  createTRPCRouter,
  projectProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import { roleCan, type ProjectRole } from "@/server/api/permissions";
import {
  activity,
  board,
  boardColumn,
  label,
  project,
  projectInvite,
  projectMember,
  task,
  user as userTable,
} from "@/server/db/schema";
import { loadInvite, normalizeEmail, sameEmail } from "@/server/invites";
import { sendProjectInviteEmail } from "@/server/mail";
import { createNotifications } from "@/server/notifications/create";
import { bus } from "@/server/realtime/bus";

async function requireOpenInvite(
  db: Parameters<typeof loadInvite>[0],
  token: string,
  viewer: { email: string },
) {
  const inv = await loadInvite(db, token);
  if (!inv) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });
  }
  if (inv.status === "used") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This invite has already been used",
    });
  }
  if (inv.status === "expired") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "This invite has expired",
    });
  }
  // link alone isn't enough -> must be signed in as the invited email
  if (!sameEmail(inv.email, viewer.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `This invite was sent to ${inv.email}. Sign in with that account to respond.`,
    });
  }
  return inv;
}

export const projectRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const access = or(
      eq(project.ownerId, userId),
      eq(projectMember.userId, userId),
    );
    const rows = await ctx.db
      .selectDistinct({
        id: project.id,
        slug: project.slug,
        key: project.key,
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        status: project.status,
        ownerId: project.ownerId,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        role: sql<ProjectRole>`case when ${project.ownerId} = ${userId} then 'owner'::kanbi_project_role else ${projectMember.role} end`.as(
          "role",
        ),
      })
      .from(project)
      .leftJoin(
        projectMember,
        and(
          eq(projectMember.projectId, project.id),
          eq(projectMember.userId, userId),
        ),
      )
      .where(and(access, ne(project.status, "archived")))
      .orderBy(desc(project.updatedAt));

    if (rows.length === 0) return [];
    const projectIds = rows.map((r) => r.id);

    // Task counts per project and explicit workflow category, non-archived only.
    const columnCounts = await ctx.db
      .select({
        projectId: board.projectId,
        columnCategory: boardColumn.category,
        count: sql<number>`count(*)::int`,
      })
      .from(task)
      .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
      .innerJoin(board, eq(board.id, task.boardId))
      .where(and(inArray(board.projectId, projectIds), isNull(task.archivedAt)))
      .groupBy(board.projectId, boardColumn.category);

    // Most recent activity per project's board.
    const lastActivity = await ctx.db
      .select({
        projectId: board.projectId,
        lastActivityAt: max(activity.createdAt),
      })
      .from(activity)
      .innerJoin(board, eq(board.id, activity.boardId))
      .where(inArray(board.projectId, projectIds))
      .groupBy(board.projectId);

    const totals = new Map<
      string,
      { totalTasks: number; doneTasks: number; inProgressTasks: number }
    >();
    for (const row of columnCounts) {
      const acc = totals.get(row.projectId) ?? {
        totalTasks: 0,
        doneTasks: 0,
        inProgressTasks: 0,
      };
      acc.totalTasks += row.count;
      if (row.columnCategory === "completed") acc.doneTasks += row.count;
      else if (row.columnCategory === "started")
        acc.inProgressTasks += row.count;
      totals.set(row.projectId, acc);
    }

    const activityByProject = new Map(
      lastActivity.map((r) => [r.projectId, r.lastActivityAt]),
    );

    const enriched = rows.map((r) => ({
      ...r,
      totalTasks: totals.get(r.id)?.totalTasks ?? 0,
      doneTasks: totals.get(r.id)?.doneTasks ?? 0,
      inProgressTasks: totals.get(r.id)?.inProgressTasks ?? 0,
      lastActivityAt: activityByProject.get(r.id) ?? null,
    }));

    // Active first (most recently active first, nulls last), then on-hold.
    const byRecency = (
      a: (typeof enriched)[number],
      b: (typeof enriched)[number],
    ) => {
      if (!a.lastActivityAt && !b.lastActivityAt) return 0;
      if (!a.lastActivityAt) return 1;
      if (!b.lastActivityAt) return -1;
      return b.lastActivityAt.getTime() - a.lastActivityAt.getTime();
    };
    const active = enriched
      .filter((p) => p.status === "active")
      .sort(byRecency);
    const onHold = enriched
      .filter((p) => p.status === "on_hold")
      .sort(byRecency);
    return [...active, ...onHold];
  }),

  listArchived: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    return ctx.db
      .selectDistinct({
        id: project.id,
        slug: project.slug,
        name: project.name,
        description: project.description,
        color: project.color,
        status: project.status,
        role: sql<ProjectRole>`case when ${project.ownerId} = ${userId} then 'owner'::kanbi_project_role else ${projectMember.role} end`.as(
          "role",
        ),
      })
      .from(project)
      .leftJoin(
        projectMember,
        and(
          eq(projectMember.projectId, project.id),
          eq(projectMember.userId, userId),
        ),
      )
      .where(
        and(
          eq(project.status, "archived"),
          or(eq(project.ownerId, userId), eq(projectMember.userId, userId)),
        ),
      )
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
          key: project.key,
          name: project.name,
          description: project.description,
          systemPrompt: project.systemPrompt,
          color: project.color,
          icon: project.icon,
          status: project.status,
          ownerId: project.ownerId,
          boardId: board.id,
          role: sql<ProjectRole | null>`case when ${project.ownerId} = ${userId} then 'owner'::kanbi_project_role else ${projectMember.role} end`,
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
        systemPrompt: z.string().max(4000).optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const base = slugify(input.name) || "project";
      const baseKey = deriveProjectKey(input.name);

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

        // Ticket key is unique per owner; suffix a counter on collision (e.g.
        // MAR, MAR2, MAR3) the same way slugs disambiguate.
        let key = baseKey;
        for (let i = 2; i < 50; i++) {
          const exists = await tx
            .select({ id: project.id })
            .from(project)
            .where(and(eq(project.ownerId, userId), eq(project.key, key)))
            .limit(1);
          if (exists.length === 0) break;
          key = `${baseKey}${i}`;
        }

        const [row] = await tx
          .insert(project)
          .values({
            ownerId: userId,
            slug,
            key,
            name: input.name,
            description: input.description,
            systemPrompt: input.systemPrompt,
            color: input.color,
            icon: input.icon,
          })
          .returning();
        if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

        const [boardRow] = await tx
          .insert(board)
          .values({ projectId: row.id })
          .returning();
        if (!boardRow) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        await tx.insert(projectMember).values({
          projectId: row.id,
          userId,
          role: "owner",
          acceptedAt: new Date(),
        });

        const [backlog, inProgress] = await tx
          .insert(boardColumn)
          .values([
            {
              boardId: boardRow.id,
              name: "Backlog",
              category: "backlog",
              position: 1,
            },
            {
              boardId: boardRow.id,
              name: "In Progress",
              category: "started",
              position: 2,
            },
            {
              boardId: boardRow.id,
              name: "Done",
              category: "completed",
              position: 3,
            },
          ])
          .returning();

        await tx.insert(label).values([
          { boardId: boardRow.id, name: "Bug", color: "#f43f5e" },
          { boardId: boardRow.id, name: "Feature", color: "#3b82f6" },
          { boardId: boardRow.id, name: "Improvement", color: "#10b981" },
          { boardId: boardRow.id, name: "Design", color: "#8b5cf6" },
        ]);

        if (backlog && inProgress) {
          // Seed tickets take the first numbers; keep the counter in sync.
          const seedTasks = [
            {
              boardId: boardRow.id,
              columnId: backlog.id,
              number: 1,
              title: "Welcome to your new board",
              description:
                "Drag tasks between columns, press **C** to quick-add, or click a task to see the full detail panel.",
              priority: "medium" as const,
              position: 1,
              reporterId: userId,
            },
            {
              boardId: boardRow.id,
              columnId: backlog.id,
              number: 2,
              title: "Invite your team",
              description:
                "Use the Share button in the top right to invite collaborators or create a read-only public link.",
              priority: "low" as const,
              position: 2,
              reporterId: userId,
            },
            {
              boardId: boardRow.id,
              columnId: inProgress.id,
              number: 3,
              title: "Try the keyboard shortcuts",
              description:
                "Press `C` anywhere to quick-add a task. More shortcuts live in the command menu.",
              priority: "none" as const,
              position: 1,
              reporterId: userId,
            },
          ];
          await tx.insert(task).values(seedTasks);
          await tx
            .update(project)
            .set({ taskCounter: seedTasks.length })
            .where(eq(project.id, row.id));
        }
        return row;
      });
    }),

  update: projectProcedure
    .input(
      z.object({
        name: z.string().min(1).max(80).optional(),
        description: z.string().max(500).nullable().optional(),
        systemPrompt: z.string().max(4000).nullable().optional(),
        color: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        key: z.string().min(2).max(10).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.access.canWrite) throw new TRPCError({ code: "FORBIDDEN" });
      const { projectId, key, ...rest } = input;

      let normalizedKey: string | undefined;
      if (key !== undefined) {
        // The key is the project's identity across every existing ticket id, so
        // gate changes on admin (owner) and guard the per-owner unique index.
        if (!ctx.access.canAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only the project owner can change the ticket key",
          });
        }
        normalizedKey = normalizeProjectKey(key);
        if (!/^[A-Z][A-Z0-9]{1,9}$/.test(normalizedKey)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Key must be 2–10 letters or digits and start with a letter",
          });
        }
        const [proj] = await ctx.db
          .select({ ownerId: project.ownerId })
          .from(project)
          .where(eq(project.id, projectId))
          .limit(1);
        if (!proj) throw new TRPCError({ code: "NOT_FOUND" });
        const clash = await ctx.db
          .select({ id: project.id })
          .from(project)
          .where(
            and(
              eq(project.ownerId, proj.ownerId),
              eq(project.key, normalizedKey),
              ne(project.id, projectId),
            ),
          )
          .limit(1);
        if (clash.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That key is already used by another of your projects",
          });
        }
      }

      await ctx.db
        .update(project)
        .set(normalizedKey ? { ...rest, key: normalizedKey } : rest)
        .where(eq(project.id, projectId));
    }),

  delete: projectProcedure.mutation(async ({ ctx, input }) => {
    assertCanAdmin(ctx.access);
    await ctx.db.delete(project).where(eq(project.id, input.projectId));
  }),

  setStatus: projectProcedure
    .input(z.object({ status: z.enum(["active", "on_hold", "archived"]) }))
    .mutation(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select({ status: project.status, boardId: board.id })
        .from(project)
        .innerJoin(board, eq(board.projectId, project.id))
        .where(eq(project.id, input.projectId))
        .limit(1);
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.status === "archived" || current.status === "archived") {
        assertCanAdmin(ctx.access);
      } else if (!ctx.access.canWrite) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      await ctx.db
        .update(project)
        .set({ status: input.status })
        .where(eq(project.id, input.projectId));
      bus.emitBoard(current.boardId, {
        scope: "board",
        ids: [current.boardId],
      });
    }),

  leave: projectProcedure.mutation(async ({ ctx, input }) => {
    if (ctx.access.role === "owner") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Owners can't leave their own project. Transfer ownership or delete the project instead.",
      });
    }
    await ctx.db
      .delete(projectMember)
      .where(
        and(
          eq(projectMember.projectId, input.projectId),
          eq(projectMember.userId, ctx.session.user.id),
        ),
      );
  }),

  invite: projectProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["editor", "viewer"]).default("editor"),
        expiresInDays: z.number().int().min(1).max(30).default(7),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.access.canAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const email = normalizeEmail(input.email);

      const [member] = await ctx.db
        .select({ userId: userTable.id })
        .from(userTable)
        .innerJoin(project, eq(project.id, input.projectId))
        .leftJoin(
          projectMember,
          and(
            eq(projectMember.projectId, project.id),
            eq(projectMember.userId, userTable.id),
          ),
        )
        .where(
          and(
            eq(userTable.email, email),
            or(
              eq(project.ownerId, userTable.id),
              eq(projectMember.userId, userTable.id),
            ),
          ),
        )
        .limit(1);
      if (member) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${email} already has access to this project`,
        });
      }

      const [pending] = await ctx.db
        .select({ id: projectInvite.id })
        .from(projectInvite)
        .where(
          and(
            eq(projectInvite.projectId, input.projectId),
            eq(projectInvite.email, email),
            isNull(projectInvite.acceptedAt),
            or(
              isNull(projectInvite.expiresAt),
              gt(projectInvite.expiresAt, new Date()),
            ),
          ),
        )
        .limit(1);
      if (pending) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `${email} already has a pending invite. Copy its link or revoke it first.`,
        });
      }

      const expiresAt = new Date(
        Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
      );
      const [row] = await ctx.db
        .insert(projectInvite)
        .values({
          projectId: input.projectId,
          email,
          role: input.role,
          token: shareToken(),
          invitedById: ctx.session.user.id,
          expiresAt,
        })
        .returning();
      if (!row) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [proj] = await ctx.db
        .select({ name: project.name })
        .from(project)
        .where(eq(project.id, input.projectId))
        .limit(1);
      try {
        await sendProjectInviteEmail(row.email, {
          token: row.token,
          projectName: proj?.name ?? "a project",
          inviterName: ctx.session.user.name,
        });
      } catch (err) {
        console.error("failed to send invite email", err);
      }

      const existing = await ctx.db
        .select({ id: userTable.id })
        .from(userTable)
        .where(eq(userTable.email, row.email))
        .limit(1);
      if (existing[0]) {
        await createNotifications(ctx.db, [
          {
            userId: existing[0].id,
            actorId: ctx.session.user.id,
            type: "project.invited",
            projectId: input.projectId,
            data: {
              projectName: proj?.name ?? "a project",
              token: row.token,
            },
          },
        ]);
      }
      return row;
    }),

  listInvites: projectProcedure.query(({ ctx, input }) =>
    ctx.db
      .select()
      .from(projectInvite)
      .where(
        and(
          eq(projectInvite.projectId, input.projectId),
          // unaccepted only
        ),
      )
      .orderBy(desc(projectInvite.createdAt)),
  ),

  revokeInvite: projectProcedure
    .input(z.object({ inviteId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.access.canAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      await ctx.db
        .delete(projectInvite)
        .where(
          and(
            eq(projectInvite.id, input.inviteId),
            eq(projectInvite.projectId, input.projectId),
          ),
        );
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const inv = await requireOpenInvite(
        ctx.db,
        input.token,
        ctx.session.user,
      );
      const userId = ctx.session.user.id;
      const now = new Date();

      const joined = await ctx.db.transaction(async (tx) => {
        // claim first -> two tabs can't both accept
        const [claimed] = await tx
          .update(projectInvite)
          .set({ acceptedAt: now })
          .where(
            and(eq(projectInvite.id, inv.id), isNull(projectInvite.acceptedAt)),
          )
          .returning({ id: projectInvite.id });
        if (!claimed) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This invite has already been used",
          });
        }
        if (inv.ownerId === userId) return false;

        const [existing] = await tx
          .select({ role: projectMember.role })
          .from(projectMember)
          .where(
            and(
              eq(projectMember.projectId, inv.projectId),
              eq(projectMember.userId, userId),
            ),
          )
          .limit(1);
        if (existing) {
          // invite may upgrade, never downgrade (owner row incl.)
          if (!roleCan(existing.role, inv.role)) {
            await tx
              .update(projectMember)
              .set({ role: inv.role })
              .where(
                and(
                  eq(projectMember.projectId, inv.projectId),
                  eq(projectMember.userId, userId),
                ),
              );
          }
          return false;
        }
        await tx.insert(projectMember).values({
          projectId: inv.projectId,
          userId,
          role: inv.role,
          acceptedAt: now,
        });
        return true;
      });

      if (joined) {
        await createNotifications(ctx.db, [
          {
            userId: inv.invitedById,
            actorId: userId,
            type: "project.member_joined",
            projectId: inv.projectId,
            data: {
              projectName: inv.projectName,
              memberName: ctx.session.user.name,
            },
          },
        ]);
      }

      return { projectSlug: inv.projectSlug };
    }),

  declineInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const inv = await requireOpenInvite(
        ctx.db,
        input.token,
        ctx.session.user,
      );
      await ctx.db.delete(projectInvite).where(eq(projectInvite.id, inv.id));
    }),

  members: projectProcedure.query(async ({ ctx, input }) => {
    return ctx.db
      .select({
        userId: projectMember.userId,
        // owner from project.ownerId; member row can be stale
        role: sql<ProjectRole>`case when ${project.ownerId} = ${projectMember.userId} then 'owner'::kanbi_project_role else ${projectMember.role} end`,
        acceptedAt: projectMember.acceptedAt,
        name: userTable.name,
        email: userTable.email,
        image: userTable.image,
      })
      .from(projectMember)
      .innerJoin(project, eq(project.id, projectMember.projectId))
      .innerJoin(userTable, eq(userTable.id, projectMember.userId))
      .where(eq(projectMember.projectId, input.projectId));
  }),

  setMemberRole: projectProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        role: z.enum(["editor", "viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.access.canAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const [proj] = await ctx.db
        .select({ ownerId: project.ownerId })
        .from(project)
        .where(eq(project.id, input.projectId))
        .limit(1);
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });
      if (proj.ownerId === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can't change the project owner's role",
        });
      }
      await ctx.db
        .update(projectMember)
        .set({ role: input.role })
        .where(
          and(
            eq(projectMember.projectId, input.projectId),
            eq(projectMember.userId, input.userId),
          ),
        );
    }),

  removeMember: projectProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.access.canAdmin) throw new TRPCError({ code: "FORBIDDEN" });
      const [proj] = await ctx.db
        .select({ ownerId: project.ownerId })
        .from(project)
        .where(eq(project.id, input.projectId))
        .limit(1);
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });
      if (proj.ownerId === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can't remove the project owner",
        });
      }
      await ctx.db
        .delete(projectMember)
        .where(
          and(
            eq(projectMember.projectId, input.projectId),
            eq(projectMember.userId, input.userId),
          ),
        );
    }),

  /** The current member's own notification preferences for this project. */
  notificationPrefs: projectProcedure.query(async ({ ctx, input }) => {
    const [row] = await ctx.db
      .select({ digestEmail: projectMember.digestEmail })
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, input.projectId),
          eq(projectMember.userId, ctx.session.user.id),
        ),
      )
      .limit(1);
    return { digestEmail: row?.digestEmail ?? false };
  }),

  setDigestEmail: projectProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(projectMember)
        .set({ digestEmail: input.enabled })
        .where(
          and(
            eq(projectMember.projectId, input.projectId),
            eq(projectMember.userId, ctx.session.user.id),
          ),
        );
      return { digestEmail: input.enabled };
    }),
});
