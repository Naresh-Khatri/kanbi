import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import type { AgentId } from "@/lib/agents";
import { resolveProjectAccess } from "@/server/api/permissions";
import { db } from "@/server/db";
import {
  board,
  boardColumn,
  milestone,
  project,
  task,
  user as userTable,
} from "@/server/db/schema";

import type { McpAuthorization } from "./authorization";
import { createMcpCaller } from "./caller";
import {
  docUrl,
  readOnly,
  resolveTask,
  taskRefInput,
  taskUrl,
  writeHints,
  agentInput,
} from "./task-ref";
import { runOnce } from "./request-key";
import { McpUserError, ok, toFailure, userFacing } from "./result";

export type MilestoneRow = {
  id: string;
  name: string;
  status: "upcoming" | "active" | "closed";
};

export const milestoneRefInput = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe('Milestone name like "v1.2" (any case), or its id.');

const statusInput = z
  .enum(["upcoming", "active"])
  .describe(
    "upcoming = planned, active = being worked on now. Several can be active. Use close_milestone to close one.",
  );

const targetDateInput = z
  .string()
  .date()
  .nullable()
  .describe("Target date YYYY-MM-DD, or null for none.");

const progressOutput = z.object({
  done: z.number().int(),
  total: z.number().int(),
});

const milestoneOutput = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.enum(["upcoming", "active", "closed"]),
  targetDate: z.string().nullable(),
  closedAt: z.string().nullable(),
  progress: progressOutput.describe(
    "done = tasks in completed columns; canceled and archived tasks don't count.",
  ),
});

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

type ListedMilestone = {
  id: string;
  name: string;
  description: string | null;
  status: "upcoming" | "active" | "closed";
  targetAt: Date | null;
  closedAt: Date | null;
  progress: { done: number; total: number };
};

const toOutput = (m: ListedMilestone) => ({
  id: m.id,
  name: m.name,
  description: m.description,
  status: m.status,
  targetDate: day(m.targetAt),
  closedAt: m.closedAt ? m.closedAt.toISOString() : null,
  progress: m.progress,
});

/** Exact id, else case-insensitive name; open ones win a name tie with closed. */
export function findMilestone<T extends MilestoneRow>(
  milestones: readonly T[],
  ref: string,
): T {
  const wanted = ref.trim();
  const byId = milestones.find((m) => m.id === wanted);
  if (byId) return byId;
  const lower = wanted.toLowerCase();
  const named = milestones.filter((m) => m.name.trim().toLowerCase() === lower);
  const open = named.filter((m) => m.status !== "closed");
  const pick = open.length > 0 ? open : named;
  if (pick.length === 1) return pick[0]!;
  const list = (ms: readonly T[]) =>
    ms.map((m) => `"${m.name}" (${m.status}, id ${m.id})`).join(", ") || "none";
  if (pick.length > 1) {
    throw new McpUserError(
      `"${wanted}" matches more than one milestone: ${list(pick)}. Pass the milestone id.`,
    );
  }
  throw new McpUserError(
    `No milestone "${wanted}" in this project. Milestones: ${list(milestones)}.`,
  );
}

export async function boardMilestones(
  boardId: string,
): Promise<MilestoneRow[]> {
  return db
    .select({
      id: milestone.id,
      name: milestone.name,
      status: milestone.status,
    })
    .from(milestone)
    .where(eq(milestone.boardId, boardId))
    .orderBy(asc(milestone.position));
}

/** Resolve a ref to an open milestone id on the board; null clears. */
export async function openMilestoneId(
  boardId: string,
  ref: string | null,
): Promise<string | null> {
  if (ref === null) return null;
  const m = findMilestone(await boardMilestones(boardId), ref);
  if (m.status === "closed") {
    throw new McpUserError(
      `Milestone "${m.name}" is closed. Reopen it with update_milestone (status active or upcoming) first, or pick an open one.`,
    );
  }
  return m.id;
}

async function projectBoard(userId: string, projectId: string) {
  await resolveProjectAccess({ db, userId, projectId });
  const [row] = await db
    .select({ id: board.id, slug: project.slug, key: project.key })
    .from(board)
    .innerJoin(project, eq(project.id, board.projectId))
    .where(eq(board.projectId, projectId))
    .limit(1);
  if (!row) throw new Error("Project board not found.");
  return row;
}

export const MILESTONE_INSTRUCTIONS = `
Milestones group a project's tasks into something the team ships together (a release, a launch, a phase). Each task is in at most one milestone. list_milestones and get_milestone are read-only. create_milestone, update_milestone, and close_milestone change the project for everyone: show the exact name, description, target date, status (or, for closing, where unfinished tasks go, whether finished ones get archived, and whether a summary doc is written) and wait for approval. set_task_milestone also needs the user's ask, but works on any task in the project, not only the user's own.
`.trim();

export function registerMilestoneTools(
  server: McpServer,
  auth: McpAuthorization,
  scopes: { read: boolean; write: boolean },
) {
  async function run(
    fn: (
      caller: Awaited<ReturnType<typeof createMcpCaller>>,
    ) => Promise<CallToolResult>,
    agent?: AgentId,
  ): Promise<CallToolResult> {
    try {
      return await fn(await createMcpCaller(auth, agent));
    } catch (err) {
      return toFailure(err);
    }
  }

  if (scopes.read) {
    server.registerTool(
      "list_milestones",
      {
        title: "List milestones",
        description:
          "List a project's milestones in board order with progress (done/total tasks). Closed ones are history; pass includeClosed false to skip them.",
        inputSchema: {
          projectId: z.string().min(1),
          includeClosed: z.boolean().optional(),
        },
        outputSchema: { milestones: z.array(milestoneOutput) },
        annotations: readOnly,
      },
      async ({ projectId, includeClosed = true }) =>
        run(async (caller) => {
          const { id: boardId } = await projectBoard(auth.userId, projectId);
          const rows = await caller.milestone.list({ boardId, includeClosed });
          return ok({ milestones: rows.map(toOutput) });
        }),
    );

    server.registerTool(
      "get_milestone",
      {
        title: "Get milestone",
        description:
          "Return one milestone with its progress and its open (non-archived) tasks: identifier, title, column, status, assignee.",
        inputSchema: {
          projectId: z.string().min(1),
          milestone: milestoneRefInput,
        },
        outputSchema: {
          milestone: milestoneOutput,
          tasks: z.array(
            z.object({
              id: z.string(),
              identifier: z.string(),
              title: z.string(),
              column: z.string(),
              status: z.string(),
              assignee: z.string().nullable(),
              url: z.string().url(),
            }),
          ),
        },
        annotations: readOnly,
      },
      async ({ projectId, milestone: ref }) =>
        run(async (caller) => {
          const pb = await projectBoard(auth.userId, projectId);
          const rows = await caller.milestone.list({ boardId: pb.id });
          const m = findMilestone(rows, ref);
          const tasks = await db
            .select({
              id: task.id,
              number: task.number,
              title: task.title,
              column: boardColumn.name,
              status: boardColumn.category,
              assignee: userTable.name,
            })
            .from(task)
            .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
            .leftJoin(userTable, eq(userTable.id, task.assigneeId))
            .where(and(eq(task.milestoneId, m.id), isNull(task.archivedAt)))
            .orderBy(asc(boardColumn.position), asc(task.position));
          return ok({
            milestone: toOutput(m),
            tasks: tasks.map((t) => ({
              id: t.id,
              identifier: `${pb.key}-${t.number}`,
              title: t.title,
              column: t.column,
              status: t.status,
              assignee: t.assignee,
              url: taskUrl(pb.slug, t.number),
            })),
          });
        }),
    );
  }

  if (!scopes.write) return;

  server.registerTool(
    "create_milestone",
    {
      title: "Create approved milestone",
      description:
        "Add a milestone to a project, as the user (editors and owners). Call only after the user approved the exact name, description, target date, and status. Pass a requestKey and reuse it on retry.",
      inputSchema: {
        projectId: z.string().min(1),
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(2_000).optional(),
        targetDate: targetDateInput.optional(),
        status: statusInput.optional(),
        requestKey: z
          .string()
          .trim()
          .min(8)
          .max(100)
          .describe(
            "Unique string (e.g. a UUID) for this approved preview. Reuse it if you retry.",
          ),
        agent: agentInput,
      },
      outputSchema: { milestone: milestoneOutput },
      annotations: { ...writeHints, idempotentHint: false },
    },
    async ({
      projectId,
      name,
      description,
      targetDate,
      status,
      requestKey,
      agent,
    }) =>
      run(async (caller) => {
        const result = await runOnce(
          auth,
          requestKey,
          {
            tool: "create_milestone",
            projectId,
            name,
            description,
            targetDate,
            status,
          },
          async () => {
            const pb = await projectBoard(auth.userId, projectId);
            const existing = await boardMilestones(pb.id);
            const clash = existing.find(
              (m) =>
                m.status !== "closed" &&
                m.name.trim().toLowerCase() === name.toLowerCase(),
            );
            if (clash) {
              throw new McpUserError(
                `An open milestone named "${clash.name}" already exists (id ${clash.id}). Pick another name or use it.`,
              );
            }
            const row = await caller.milestone
              .create({
                boardId: pb.id,
                name,
                description: description || null,
                targetAt: targetDate ? new Date(targetDate) : null,
                status,
              })
              .catch(userFacing);
            return {
              milestone: toOutput({ ...row, progress: { done: 0, total: 0 } }),
            };
          },
        );
        return ok(result);
      }, agent),
  );

  server.registerTool(
    "update_milestone",
    {
      title: "Update approved milestone",
      description:
        "Rename a milestone, change its description, target date, or status, as the user. Setting status on a closed milestone reopens it. Call only after the user approved the exact change. Safe to repeat.",
      inputSchema: {
        projectId: z.string().min(1),
        milestone: milestoneRefInput,
        name: z.string().trim().min(1).max(80).optional(),
        description: z
          .string()
          .trim()
          .max(2_000)
          .nullable()
          .optional()
          .describe("New description, or null to clear."),
        targetDate: targetDateInput.optional(),
        status: statusInput.optional(),
        agent: agentInput,
      },
      outputSchema: { milestone: milestoneOutput },
      annotations: writeHints,
    },
    async ({
      projectId,
      milestone: ref,
      name,
      description,
      targetDate,
      status,
      agent,
    }) =>
      run(async (caller) => {
        if (
          name === undefined &&
          description === undefined &&
          targetDate === undefined &&
          !status
        ) {
          throw new McpUserError(
            "Pass at least one of name, description, targetDate, or status.",
          );
        }
        const pb = await projectBoard(auth.userId, projectId);
        const m = findMilestone(await boardMilestones(pb.id), ref);
        await caller.milestone
          .update({
            boardId: pb.id,
            milestoneId: m.id,
            name,
            description,
            targetAt:
              targetDate === undefined
                ? undefined
                : targetDate
                  ? new Date(targetDate)
                  : null,
            status,
          })
          .catch(userFacing);
        const rows = await caller.milestone.list({ boardId: pb.id });
        const updated = rows.find((r) => r.id === m.id);
        if (!updated)
          throw new McpUserError("That milestone was deleted meanwhile.");
        return ok({ milestone: toOutput(updated) });
      }, agent),
  );

  server.registerTool(
    "close_milestone",
    {
      title: "Close approved milestone",
      description:
        "Close a milestone, as the user. Finished tasks (completed or canceled columns) are archived unless archiveFinished is false; unfinished ones move to moveUnfinishedTo (another open milestone) or out of any milestone when it's omitted or null. writeSummary adds a Doc recapping what shipped. Call only after the user approved all of that.",
      inputSchema: {
        projectId: z.string().min(1),
        milestone: milestoneRefInput,
        moveUnfinishedTo: milestoneRefInput.nullable().optional(),
        archiveFinished: z.boolean().optional(),
        writeSummary: z.boolean().optional(),
        agent: agentInput,
      },
      outputSchema: {
        name: z.string(),
        finished: z.number().int(),
        archived: z.number().int(),
        carried: z.number().int(),
        carriedTo: z.string().nullable(),
        summaryDocUrl: z.string().url().nullable(),
      },
      annotations: {
        ...writeHints,
        destructiveHint: true,
        idempotentHint: false,
      },
    },
    async ({
      projectId,
      milestone: ref,
      moveUnfinishedTo = null,
      archiveFinished = true,
      writeSummary = false,
      agent,
    }) =>
      run(async (caller) => {
        const pb = await projectBoard(auth.userId, projectId);
        const all = await boardMilestones(pb.id);
        const m = findMilestone(all, ref);
        if (m.status === "closed") {
          throw new McpUserError(`Milestone "${m.name}" is already closed.`);
        }
        const target = moveUnfinishedTo
          ? findMilestone(all, moveUnfinishedTo)
          : null;
        if (target?.id === m.id) {
          throw new McpUserError(
            "Move unfinished tasks to a different milestone.",
          );
        }
        const result = await caller.milestone
          .close({
            boardId: pb.id,
            milestoneId: m.id,
            moveUnfinishedTo: target?.id ?? null,
            archiveFinished,
            writeSummary,
          })
          .catch(userFacing);
        return ok({
          name: m.name,
          finished: result.finished,
          archived: result.archived,
          carried: result.carried,
          carriedTo: result.carriedTo?.name ?? null,
          summaryDocUrl: result.documentId
            ? docUrl(pb.slug, result.documentId)
            : null,
        });
      }, agent),
  );

  server.registerTool(
    "set_task_milestone",
    {
      title: "Set task milestone",
      description:
        "Put tasks into a milestone, or take them out with milestone null, as the user. Only when the user asks. Works on any task in the project, not only the user's own. All tasks must be in the same project.",
      inputSchema: {
        tasks: z.array(taskRefInput).min(1).max(50),
        milestone: milestoneRefInput.nullable(),
        agent: agentInput,
      },
      outputSchema: {
        milestone: z.string().nullable(),
        updated: z.array(z.string()),
      },
      annotations: writeHints,
    },
    async ({ tasks: refs, milestone: ref, agent }) =>
      run(async (caller) => {
        const resolved = [];
        for (const r of [...new Set(refs)])
          resolved.push(await resolveTask(caller, r));
        const boardIds = new Set(resolved.map((t) => t.boardId));
        if (boardIds.size > 1) {
          throw new McpUserError(
            "Those tasks are in different projects. Call once per project.",
          );
        }
        const boardId = resolved[0]!.boardId;
        const all = await boardMilestones(boardId);
        const milestoneId = await openMilestoneId(boardId, ref);
        for (const t of resolved) {
          await caller.task
            .update({ boardId, taskId: t.id, milestoneId })
            .catch(userFacing);
        }
        return ok({
          milestone: all.find((m) => m.id === milestoneId)?.name ?? null,
          updated: resolved.map((t) => t.identifier),
        });
      }, agent),
  );
}
