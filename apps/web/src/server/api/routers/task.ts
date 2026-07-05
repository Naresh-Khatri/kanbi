import { TRPCError } from "@trpc/server";
import { generateObject } from "ai";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";

import type { db as Database } from "@/server/db";
import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { POSITION_STEP, positionAtEnd, positionBetween } from "@/lib/position";
import { recordActivity } from "@/server/activity/record";
import { draftModel } from "@/server/ai/mistral";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/server/api/trpc";
import {
  board,
  boardColumn,
  checklistItem,
  label,
  project,
  projectMember,
  task,
  taskLabel,
  taskPriority,
  user as userTable,
} from "@/server/db/schema";
import { createNotifications } from "@/server/notifications/create";
import { resolveMentions } from "@/server/notifications/mentions";
import { bus } from "@/server/realtime/bus";

const priorityEnum = z.enum(taskPriority.enumValues);
const confidenceEnum = z.enum(["high", "med", "low"]);

// AI emits dueAt as a calendar day (YYYY-MM-DD); the client turns it into a Date.
const draftDueAtSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .default(null);

// A variant is one way to write the same issue — only the wording and the
// breakdown differ. Ownership/scheduling attributes live on the issue so they
// don't silently change when the user flips between variants.
const draftVariantSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).default(""),
  checklist: z.array(z.string().min(1).max(280)).max(20).default([]),
});

const draftIssueSchema = z.object({
  summary: z.string().min(1).max(300),
  confidence: confidenceEnum.default("med"),
  priority: priorityEnum.default("none"),
  labelIds: z.array(z.string()).default([]),
  assigneeId: z.string().nullable().default(null),
  dueAt: draftDueAtSchema,
  variants: z.array(draftVariantSchema).min(1).max(3),
});

const draftResponseSchema = z.object({
  issues: z.array(draftIssueSchema).max(10),
});

const enhanceResponseSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).default(""),
  priority: priorityEnum.default("none"),
  labelIds: z.array(z.string()).default([]),
  assigneeId: z.string().nullable().default(null),
  dueAt: draftDueAtSchema,
  checklist: z.array(z.string().min(1).max(280)).max(20).default([]),
});

/**
 * Atomically issue `count` consecutive ticket numbers for a board's project and
 * return them alongside the project key. A single `UPDATE … RETURNING` bumps the
 * counter under a row lock, so concurrent creators never collide; the unique
 * index on (board_id, number) is the final backstop. A failed insert afterwards
 * just leaves a gap in the sequence, which is fine (Jira behaves the same way).
 */
async function reserveTaskNumbers(
  db: typeof Database,
  boardId: string,
  count: number,
): Promise<{ key: string; numbers: number[] }> {
  const [row] = await db
    .update(project)
    .set({ taskCounter: sql`${project.taskCounter} + ${count}` })
    .from(board)
    .where(and(eq(board.id, boardId), eq(board.projectId, project.id)))
    .returning({ key: project.key, counter: project.taskCounter });
  if (!row) throw new TRPCError({ code: "NOT_FOUND" });
  const start = row.counter - count + 1;
  return {
    key: row.key,
    numbers: Array.from({ length: count }, (_, i) => start + i),
  };
}

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

      const { numbers } = await reserveTaskNumbers(ctx.db, input.boardId, 1);

      const [row] = await ctx.db
        .insert(task)
        .values({
          boardId: input.boardId,
          columnId: input.columnId,
          number: numbers[0]!,
          title: input.title,
          description: input.description,
          priority: input.priority ?? "none",
          position: positionAtEnd(existing),
          reporterId: ctx.session.user.id,
          assigneeId: input.assigneeId ?? null,
          dueAt: input.dueAt ?? null,
        })
        .returning();
      bus.emitBoard(input.boardId, { scope: "task", ids: row ? [row.id] : [] });
      if (row) {
        await recordActivity(ctx.db, {
          boardId: input.boardId,
          taskId: row.id,
          actorId: ctx.session.user.id,
          verb: "task.created",
          payload: { title: row.title },
        });
        const pending: Parameters<typeof createNotifications>[1] = [];
        if (row.assigneeId) {
          pending.push({
            userId: row.assigneeId,
            actorId: ctx.session.user.id,
            type: "task.assigned",
            boardId: input.boardId,
            taskId: row.id,
            data: { title: row.title },
          });
        }
        if (row.description) {
          const mentioned = await resolveMentions(
            ctx.db,
            input.boardId,
            row.description,
          );
          for (const userId of mentioned) {
            if (userId === row.assigneeId) continue;
            pending.push({
              userId,
              actorId: ctx.session.user.id,
              type: "task.mention",
              boardId: input.boardId,
              taskId: row.id,
              data: { title: row.title },
            });
          }
        }
        if (pending.length > 0) await createNotifications(ctx.db, pending);
      }
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

      const existingRows = await ctx.db
        .select({
          assigneeId: task.assigneeId,
          title: task.title,
          description: task.description,
        })
        .from(task)
        .where(and(eq(task.id, taskId), eq(task.boardId, boardId)))
        .limit(1);
      const previous = existingRows[0];

      await ctx.db
        .update(task)
        .set(rest)
        .where(and(eq(task.id, taskId), eq(task.boardId, boardId)));
      bus.emitBoard(boardId, { scope: "task", ids: [taskId] });
      await recordActivity(ctx.db, {
        boardId,
        taskId,
        actorId: ctx.session.user.id,
        verb: "task.updated",
        payload: { fields: Object.keys(rest) },
      });

      if (
        "assigneeId" in rest &&
        previous &&
        rest.assigneeId !== previous.assigneeId
      ) {
        const title = rest.title ?? previous.title;
        const pending = [] as Parameters<typeof createNotifications>[1];
        if (previous.assigneeId) {
          pending.push({
            userId: previous.assigneeId,
            actorId: ctx.session.user.id,
            type: "task.unassigned",
            boardId,
            taskId,
            data: { title },
          });
        }
        if (rest.assigneeId) {
          pending.push({
            userId: rest.assigneeId,
            actorId: ctx.session.user.id,
            type: "task.assigned",
            boardId,
            taskId,
            data: { title },
          });
        }
        if (pending.length > 0) await createNotifications(ctx.db, pending);
      }

      if ("description" in rest && previous && rest.description) {
        const before = new Set(
          await resolveMentions(ctx.db, boardId, previous.description ?? ""),
        );
        const after = await resolveMentions(ctx.db, boardId, rest.description);
        const newly = after.filter((id) => !before.has(id));
        if (newly.length > 0) {
          await createNotifications(
            ctx.db,
            newly.map((userId) => ({
              userId,
              actorId: ctx.session.user.id,
              type: "task.mention" as const,
              boardId,
              taskId,
              data: { title: rest.title ?? previous.title },
            })),
          );
        }
      }
    }),

  delete: boardProcedure
    .input(z.object({ taskId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .delete(task)
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
      bus.emitBoard(input.boardId, { scope: "task", ids: [input.taskId] });
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
        .select({ boardId: boardColumn.boardId, name: boardColumn.name })
        .from(boardColumn)
        .where(eq(boardColumn.id, input.toColumnId))
        .limit(1);
      if (!col[0] || col[0].boardId !== input.boardId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const existing = await ctx.db
        .select({
          columnId: task.columnId,
          title: task.title,
          reporterId: task.reporterId,
          assigneeId: task.assigneeId,
        })
        .from(task)
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)))
        .limit(1);
      const prev = existing[0];

      await ctx.db
        .update(task)
        .set({
          columnId: input.toColumnId,
          position: positionBetween(input.before, input.after),
        })
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
      bus.emitBoard(input.boardId, { scope: "task", ids: [input.taskId] });
      await recordActivity(ctx.db, {
        boardId: input.boardId,
        taskId: input.taskId,
        actorId: ctx.session.user.id,
        verb: "task.moved",
        payload: { toColumnId: input.toColumnId },
      });

      const target = col[0];
      if (
        prev &&
        target &&
        prev.columnId !== input.toColumnId &&
        isDoneLikeColumn(target.name)
      ) {
        const recipients = new Set<string>();
        if (prev.reporterId) recipients.add(prev.reporterId);
        if (prev.assigneeId) recipients.add(prev.assigneeId);
        recipients.delete(ctx.session.user.id);
        if (recipients.size > 0) {
          await createNotifications(
            ctx.db,
            [...recipients].map((userId) => ({
              userId,
              actorId: ctx.session.user.id,
              type: "task.moved_to_done" as const,
              boardId: input.boardId,
              taskId: input.taskId,
              data: { title: prev.title, columnName: target.name },
            })),
          );
        }
      }
    }),

  archive: boardProcedure
    .input(z.object({ taskId: z.string().min(1), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(task)
        .set({ archivedAt: input.archived ? new Date() : null })
        .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
      bus.emitBoard(input.boardId, { scope: "task", ids: [input.taskId] });
    }),

  // Cross-project task lookup for the command palette (jump-to-task). Scoped to
  // boards the caller can reach via project ownership or membership.
  search: protectedProcedure
    .input(
      z.object({
        query: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(20).default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const term = `%${input.query.replace(/[\\%_]/g, "\\$&")}%`;
      return ctx.db
        .selectDistinct({
          id: task.id,
          title: task.title,
          number: task.number,
          updatedAt: task.updatedAt,
          boardId: task.boardId,
          projectSlug: project.slug,
          projectKey: project.key,
          projectName: project.name,
        })
        .from(task)
        .innerJoin(board, eq(board.id, task.boardId))
        .innerJoin(project, eq(project.id, board.projectId))
        .leftJoin(
          projectMember,
          and(
            eq(projectMember.projectId, project.id),
            eq(projectMember.userId, userId),
          ),
        )
        .where(
          and(
            isNull(task.archivedAt),
            ilike(task.title, term),
            or(eq(project.ownerId, userId), eq(projectMember.userId, userId)),
          ),
        )
        .orderBy(desc(task.updatedAt))
        .limit(input.limit);
    }),

  draftFromMessage: boardProcedure
    .input(z.object({ message: z.string().min(1).max(8000) }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);

      const projectRow = await ctx.db
        .select({
          name: project.name,
          description: project.description,
          systemPrompt: project.systemPrompt,
        })
        .from(board)
        .innerJoin(project, eq(project.id, board.projectId))
        .where(eq(board.id, input.boardId))
        .limit(1);
      const proj = projectRow[0];
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

      const labels = await ctx.db
        .select({ id: label.id, name: label.name })
        .from(label)
        .where(eq(label.boardId, input.boardId));

      const members = await ctx.db
        .select({ id: projectMember.userId, name: userTable.name })
        .from(projectMember)
        .innerJoin(board, eq(board.projectId, projectMember.projectId))
        .innerJoin(userTable, eq(userTable.id, projectMember.userId))
        .where(eq(board.id, input.boardId));

      const priorities = taskPriority.enumValues.join(", ");
      const labelList =
        labels.length > 0
          ? labels.map((l) => `- ${l.id}: ${l.name}`).join("\n")
          : "(no labels defined)";
      const memberList =
        members.length > 0
          ? members.map((m) => `- ${m.id}: ${m.name}`).join("\n")
          : "(no members defined)";
      const today = new Date().toISOString().slice(0, 10);

      const system = [
        "You are a task drafter for a kanban board. Read a raw client message and extract distinct actionable issues.",
        `Project: ${proj.name}${proj.description ? ` — ${proj.description}` : ""}`,
        proj.systemPrompt ? `Project context:\n${proj.systemPrompt}` : "",
        `Available labels (use exact ids, never invent):\n${labelList}`,
        `Available priorities: ${priorities}`,
        `Project members (use exact ids, never invent):\n${memberList}`,
        `Today's date is ${today}.`,
        "Output JSON matching this shape exactly:",
        `{"issues":[{"summary":string,"confidence":"high"|"med"|"low","priority":"urgent"|"high"|"medium"|"low"|"none","labelIds":string[],"assigneeId":string|null,"dueAt":string|null,"variants":[{"title":string,"description":string,"checklist":string[]}]}]}`,
        "Rules:",
        "- One issue per distinct problem/request. If the message is a single issue, return one.",
        "- priority, labelIds, assigneeId, and dueAt describe the issue as a whole — set them once per issue, NOT per variant.",
        "- Produce exactly 3 variants per issue: concise, detailed, and aggressive-scope. Variants differ ONLY in title, description, and checklist depth.",
        "- title: imperative, under 80 chars.",
        "- description: simple HTML only (use <p>, <strong>, <em>, <code>, <a href>, and <ul>/<ol> with <li>). No markdown, no <script>/<style>/<img>. It doesn't have to be one linear paragraph — use multiple paragraphs and bullet lists when they make it clearer (context, rationale, acceptance criteria, edge cases), but don't pad a simple task; a sentence or two is fine. Keep implementation steps in the checklist, not here, and don't restate the checklist items.",
        "- checklist: the actionable implementation steps as short plain-text strings (no HTML), each a single concrete subtask. These are distinct from the description. Use [] when the issue needs no breakdown; the aggressive-scope variant may include more steps.",
        "- Only use labelIds from the list above. If none fit, use [].",
        "- assigneeId: only a member id from the list above when the message clearly names who should own it. Otherwise null. Never invent ids.",
        "- dueAt: an absolute calendar day in YYYY-MM-DD format when the message implies a deadline (resolve relative dates like 'next Friday' against today's date). Otherwise null.",
        "- confidence = how confident you are this is a real, well-scoped issue.",
        "- Do not include commentary. Return only the JSON object.",
      ]
        .filter(Boolean)
        .join("\n\n");

      let result;
      try {
        result = (
          await generateObject({
            model: draftModel(),
            schema: draftResponseSchema,
            temperature: 0.6,
            system,
            prompt: input.message,
          })
        ).object;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI response did not match expected shape",
        });
      }

      const validLabels = new Set(labels.map((l) => l.id));
      const validMembers = new Set(members.map((m) => m.id));
      const issues = result.issues.map((issue) => ({
        ...issue,
        labelIds: issue.labelIds.filter((id) => validLabels.has(id)),
        assigneeId:
          issue.assigneeId && validMembers.has(issue.assigneeId)
            ? issue.assigneeId
            : null,
      }));

      return { issues };
    }),

  enhance: boardProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().max(10_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);

      const projectRow = await ctx.db
        .select({
          name: project.name,
          description: project.description,
          systemPrompt: project.systemPrompt,
        })
        .from(board)
        .innerJoin(project, eq(project.id, board.projectId))
        .where(eq(board.id, input.boardId))
        .limit(1);
      const proj = projectRow[0];
      if (!proj) throw new TRPCError({ code: "NOT_FOUND" });

      const labels = await ctx.db
        .select({ id: label.id, name: label.name })
        .from(label)
        .where(eq(label.boardId, input.boardId));

      const members = await ctx.db
        .select({ id: projectMember.userId, name: userTable.name })
        .from(projectMember)
        .innerJoin(board, eq(board.projectId, projectMember.projectId))
        .innerJoin(userTable, eq(userTable.id, projectMember.userId))
        .where(eq(board.id, input.boardId));

      const priorities = taskPriority.enumValues.join(", ");
      const labelList =
        labels.length > 0
          ? labels.map((l) => `- ${l.id}: ${l.name}`).join("\n")
          : "(no labels defined)";
      const memberList =
        members.length > 0
          ? members.map((m) => `- ${m.id}: ${m.name}`).join("\n")
          : "(no members defined)";
      const today = new Date().toISOString().slice(0, 10);

      const system = [
        "You are a task editor for a kanban board. Polish a single rough task into one clear, well-scoped task. Never split it into multiple tasks.",
        `Project: ${proj.name}${proj.description ? ` — ${proj.description}` : ""}`,
        proj.systemPrompt ? `Project context:\n${proj.systemPrompt}` : "",
        `Available labels (use exact ids, never invent):\n${labelList}`,
        `Available priorities: ${priorities}`,
        `Project members (use exact ids, never invent):\n${memberList}`,
        `Today's date is ${today}.`,
        "Output JSON matching this shape exactly:",
        `{"title":string,"description":string,"priority":"urgent"|"high"|"medium"|"low"|"none","labelIds":string[],"assigneeId":string|null,"dueAt":string|null,"checklist":string[]}`,
        "Rules:",
        "- Keep it a single task. Rewrite the title as a clear imperative under 80 chars.",
        "- description: simple HTML only (use <p>, <strong>, <em>, <code>, <a href>, and <ul>/<ol> with <li>). No markdown, no <script>/<style>/<img>. It doesn't have to be one linear paragraph — use multiple paragraphs and bullet lists when they make it clearer (context, rationale, acceptance criteria, edge cases), but don't pad a simple task; a sentence or two is fine. Keep implementation steps in the checklist, not here, and don't restate the checklist items.",
        "- Only use labelIds from the list above. If none fit, use [].",
        "- Pick the most fitting priority.",
        "- checklist: OPTIONAL plain-text subtasks (the implementation steps). Only include items when the task naturally breaks into concrete steps; each item is a short imperative (no numbering, no HTML). If the task is atomic or steps would be noise, return [].",
        "- assigneeId: only a member id from the list above when the input clearly names who should own it. Otherwise null. Never invent ids.",
        "- dueAt: an absolute calendar day in YYYY-MM-DD format when the input implies a deadline (resolve relative dates like 'next Friday' against today's date). Otherwise null.",
        "- Do not include commentary. Return only the JSON object.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const userContent = [
        `Title: ${input.title}`,
        input.description ? `Description (HTML): ${input.description}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      let result;
      try {
        result = (
          await generateObject({
            model: draftModel(),
            schema: enhanceResponseSchema,
            temperature: 0.5,
            system,
            prompt: userContent,
          })
        ).object;
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI response did not match expected shape",
        });
      }

      const validLabels = new Set(labels.map((l) => l.id));
      const validMembers = new Set(members.map((m) => m.id));
      return {
        ...result,
        labelIds: result.labelIds.filter((id) => validLabels.has(id)),
        assigneeId:
          result.assigneeId && validMembers.has(result.assigneeId)
            ? result.assigneeId
            : null,
      };
    }),

  createMany: boardProcedure
    .input(
      z.object({
        tasks: z
          .array(
            z.object({
              columnId: z.string().min(1),
              title: z.string().min(1).max(200),
              description: z.string().max(10_000).optional(),
              priority: priorityEnum.optional(),
              labelIds: z.array(z.string()).optional(),
              assigneeId: z.string().nullable().optional(),
              dueAt: z.date().nullable().optional(),
              checklist: z.array(z.string().min(1).max(280)).max(20).optional(),
            }),
          )
          .min(1)
          .max(20),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);

      const columnIds = Array.from(new Set(input.tasks.map((t) => t.columnId)));
      const cols = await ctx.db
        .select({ id: boardColumn.id, boardId: boardColumn.boardId })
        .from(boardColumn)
        .where(inArray(boardColumn.id, columnIds));
      if (
        cols.length !== columnIds.length ||
        cols.some((c) => c.boardId !== input.boardId)
      ) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const endPositions = new Map<string, number>();
      for (const columnId of columnIds) {
        const existing = await ctx.db
          .select({ position: task.position })
          .from(task)
          .where(eq(task.columnId, columnId))
          .orderBy(asc(task.position));
        endPositions.set(columnId, positionAtEnd(existing));
      }

      const allLabelIds = Array.from(
        new Set(input.tasks.flatMap((t) => t.labelIds ?? [])),
      );
      const validLabels = new Set<string>();
      if (allLabelIds.length > 0) {
        const rows = await ctx.db
          .select({ id: label.id })
          .from(label)
          .where(
            and(
              eq(label.boardId, input.boardId),
              inArray(label.id, allLabelIds),
            ),
          );
        for (const r of rows) validLabels.add(r.id);
      }

      const { numbers } = await reserveTaskNumbers(
        ctx.db,
        input.boardId,
        input.tasks.length,
      );

      const values = input.tasks.map((t, i) => {
        const pos = endPositions.get(t.columnId) ?? 1_000_000;
        endPositions.set(t.columnId, pos + 1_000_000);
        return {
          boardId: input.boardId,
          columnId: t.columnId,
          number: numbers[i]!,
          title: t.title,
          description: t.description,
          priority: t.priority ?? ("none" as const),
          position: pos,
          reporterId: ctx.session.user.id,
          assigneeId: t.assigneeId ?? null,
          dueAt: t.dueAt ?? null,
        };
      });

      const inserted = await ctx.db.insert(task).values(values).returning();

      const labelRows: { taskId: string; labelId: string }[] = [];
      inserted.forEach((row, i) => {
        const ids = input.tasks[i]?.labelIds ?? [];
        for (const labelId of ids) {
          if (validLabels.has(labelId)) {
            labelRows.push({ taskId: row.id, labelId });
          }
        }
      });
      if (labelRows.length > 0) {
        await ctx.db.insert(taskLabel).values(labelRows).onConflictDoNothing();
      }

      const checklistRows: {
        taskId: string;
        text: string;
        position: number;
      }[] = [];
      inserted.forEach((row, i) => {
        const items = input.tasks[i]?.checklist ?? [];
        items.forEach((text, j) => {
          checklistRows.push({
            taskId: row.id,
            text,
            position: (j + 1) * POSITION_STEP,
          });
        });
      });
      if (checklistRows.length > 0) {
        await ctx.db.insert(checklistItem).values(checklistRows);
      }

      bus.emitBoard(input.boardId, {
        scope: "task",
        ids: inserted.map((r) => r.id),
      });
      const checklistTaskIds = Array.from(
        new Set(checklistRows.map((r) => r.taskId)),
      );
      if (checklistTaskIds.length > 0) {
        bus.emitBoard(input.boardId, {
          scope: "checklist",
          ids: checklistTaskIds,
        });
      }

      for (const row of inserted) {
        await recordActivity(ctx.db, {
          boardId: input.boardId,
          taskId: row.id,
          actorId: ctx.session.user.id,
          verb: "task.created",
          payload: { title: row.title },
        });
      }

      const assignmentNotifications: Parameters<typeof createNotifications>[1] =
        [];
      for (const row of inserted) {
        if (row.assigneeId && row.assigneeId !== ctx.session.user.id) {
          assignmentNotifications.push({
            userId: row.assigneeId,
            actorId: ctx.session.user.id,
            type: "task.assigned",
            boardId: input.boardId,
            taskId: row.id,
            data: { title: row.title },
          });
        }
      }
      if (assignmentNotifications.length > 0) {
        await createNotifications(ctx.db, assignmentNotifications);
      }

      return { count: inserted.length, ids: inserted.map((r) => r.id) };
    }),
});
