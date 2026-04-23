import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { isDoneLikeColumn } from "@/lib/column-heuristics";
import { positionAtEnd, positionBetween } from "@/lib/position";
import { recordActivity } from "@/server/activity/record";
import { GROQ_DRAFT_MODEL, getGroq } from "@/server/ai/groq";
import {
  assertCanWrite,
  boardProcedure,
  createTRPCRouter,
} from "@/server/api/trpc";
import {
  board,
  boardColumn,
  label,
  project,
  task,
  taskLabel,
  taskPriority,
} from "@/server/db/schema";
import { createNotifications } from "@/server/notifications/create";
import { resolveMentions } from "@/server/notifications/mentions";
import { bus } from "@/server/realtime/bus";

const priorityEnum = z.enum(taskPriority.enumValues);
const confidenceEnum = z.enum(["high", "med", "low"]);

const draftVariantSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(10_000).default(""),
  priority: priorityEnum.default("none"),
  labelIds: z.array(z.string()).default([]),
});

const draftIssueSchema = z.object({
  summary: z.string().min(1).max(300),
  confidence: confidenceEnum.default("med"),
  variants: z.array(draftVariantSchema).min(1).max(3),
});

const draftResponseSchema = z.object({
  issues: z.array(draftIssueSchema).max(10),
});

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

      const priorities = taskPriority.enumValues.join(", ");
      const labelList =
        labels.length > 0
          ? labels.map((l) => `- ${l.id}: ${l.name}`).join("\n")
          : "(no labels defined)";

      const system = [
        "You are a task drafter for a kanban board. Read a raw client message and extract distinct actionable issues.",
        `Project: ${proj.name}${proj.description ? ` — ${proj.description}` : ""}`,
        proj.systemPrompt ? `Project context:\n${proj.systemPrompt}` : "",
        `Available labels (use exact ids, never invent):\n${labelList}`,
        `Available priorities: ${priorities}`,
        "Output JSON matching this shape exactly:",
        `{"issues":[{"summary":string,"confidence":"high"|"med"|"low","variants":[{"title":string,"description":string,"priority":"urgent"|"high"|"medium"|"low"|"none","labelIds":string[]}]}]}`,
        "Rules:",
        "- One issue per distinct problem/request. If the message is a single issue, return one.",
        "- Produce exactly 3 variants per issue: concise, detailed, and aggressive-scope.",
        "- title: imperative, under 80 chars. description: markdown, concrete acceptance criteria when sensible.",
        "- Only use labelIds from the list above. If none fit, use [].",
        "- confidence = how confident you are this is a real, well-scoped issue.",
        "- Do not include commentary. Return only the JSON object.",
      ]
        .filter(Boolean)
        .join("\n\n");

      const groq = getGroq();
      const completion = await groq.chat.completions.create({
        model: GROQ_DRAFT_MODEL,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: input.message },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI returned invalid JSON",
        });
      }

      const result = draftResponseSchema.safeParse(parsed);
      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "AI response did not match expected shape",
        });
      }

      const validLabels = new Set(labels.map((l) => l.id));
      const issues = result.data.issues.map((issue) => ({
        ...issue,
        variants: issue.variants.map((v) => ({
          ...v,
          labelIds: v.labelIds.filter((id) => validLabels.has(id)),
        })),
      }));

      return { issues };
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

      const values = input.tasks.map((t) => {
        const pos = endPositions.get(t.columnId) ?? 1_000_000;
        endPositions.set(t.columnId, pos + 1_000_000);
        return {
          boardId: input.boardId,
          columnId: t.columnId,
          title: t.title,
          description: t.description,
          priority: t.priority ?? ("none" as const),
          position: pos,
          reporterId: ctx.session.user.id,
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

      bus.emitBoard(input.boardId, {
        scope: "task",
        ids: inserted.map((r) => r.id),
      });

      for (const row of inserted) {
        await recordActivity(ctx.db, {
          boardId: input.boardId,
          taskId: row.id,
          actorId: ctx.session.user.id,
          verb: "task.created",
          payload: { title: row.title },
        });
      }

      return { count: inserted.length, ids: inserted.map((r) => r.id) };
    }),
});
