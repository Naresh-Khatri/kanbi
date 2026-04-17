import { TRPCError } from "@trpc/server";
import { and, desc, eq, or } from "drizzle-orm";
import { z } from "zod";

import { shareToken, slugify, slugSuffix } from "@/lib/ids";
import {
  assertCanAdmin,
  createTRPCRouter,
  projectProcedure,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  board,
  boardColumn,
  label,
  project,
  projectInvite,
  projectMember,
  task,
  user as userTable,
} from "@/server/db/schema";
import { sendProjectInviteEmail } from "@/server/mail";

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
            { boardId: boardRow.id, name: "Backlog", position: 1 },
            { boardId: boardRow.id, name: "In Progress", position: 2 },
            { boardId: boardRow.id, name: "Done", position: 3 },
          ])
          .returning();

        await tx.insert(label).values([
          { boardId: boardRow.id, name: "Bug", color: "#f43f5e" },
          { boardId: boardRow.id, name: "Feature", color: "#3b82f6" },
          { boardId: boardRow.id, name: "Improvement", color: "#10b981" },
          { boardId: boardRow.id, name: "Design", color: "#8b5cf6" },
        ]);

        if (backlog && inProgress) {
          await tx.insert(task).values([
            {
              boardId: boardRow.id,
              columnId: backlog.id,
              title: "Welcome to your new board",
              description:
                "Drag tasks between columns, press **C** to quick-add, or click a task to see the full detail panel.",
              priority: "medium",
              position: 1,
              reporterId: userId,
            },
            {
              boardId: boardRow.id,
              columnId: backlog.id,
              title: "Invite your team",
              description:
                "Use the Share button in the top right to invite collaborators or create a read-only public link.",
              priority: "low",
              position: 2,
              reporterId: userId,
            },
            {
              boardId: boardRow.id,
              columnId: inProgress.id,
              title: "Try the keyboard shortcuts",
              description:
                "Press `C` anywhere to quick-add a task. More shortcuts live in the command menu.",
              priority: "none",
              position: 1,
              reporterId: userId,
            },
          ]);
        }
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
      const expiresAt = new Date(
        Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
      );
      const [row] = await ctx.db
        .insert(projectInvite)
        .values({
          projectId: input.projectId,
          email: input.email.toLowerCase(),
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
      const now = new Date();
      const row = await ctx.db
        .select()
        .from(projectInvite)
        .where(eq(projectInvite.token, input.token))
        .limit(1);
      const inv = row[0];
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      if (inv.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite already used",
        });
      }
      if (inv.expiresAt && inv.expiresAt < now) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite expired",
        });
      }

      const userId = ctx.session.user.id;
      await ctx.db
        .insert(projectMember)
        .values({
          projectId: inv.projectId,
          userId,
          role: inv.role,
          acceptedAt: now,
        })
        .onConflictDoUpdate({
          target: [projectMember.projectId, projectMember.userId],
          set: { role: inv.role, acceptedAt: now },
        });

      await ctx.db
        .update(projectInvite)
        .set({ acceptedAt: now })
        .where(eq(projectInvite.id, inv.id));

      const p = await ctx.db
        .select({ slug: project.slug })
        .from(project)
        .where(eq(project.id, inv.projectId))
        .limit(1);
      return { projectSlug: p[0]?.slug ?? null };
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
