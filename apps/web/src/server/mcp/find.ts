import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db } from "@/server/db";
import {
  board,
  boardColumn,
  columnCategory,
  label,
  project,
  projectMember,
  task,
  taskLabel,
  taskPriority,
  user as userTable,
} from "@/server/db/schema";

import type { McpAuthorization } from "./authorization";
import { createMcpCaller } from "./caller";
import { MCP_ORIGIN } from "./config";
import { McpUserError, ok, toFailure } from "./result";

const DAY_MS = 86_400_000;

const personRef = z.object({ id: z.string(), name: z.string() });

const day = (date: Date) => date.toISOString().slice(0, 10);
const startOfDayUtc = (value: string) => new Date(`${value}T00:00:00.000Z`);
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

type Person = { id: string; name: string; email: string };

// exact name/email/local part beats name-word prefix; >1 hit = ambiguous
function matchPeople(people: Person[], hint: string): Person[] {
  const h = hint.trim().toLowerCase();
  const exact = people.filter((p) =>
    [p.name, p.email, p.email.split("@")[0]].some(
      (v) => v?.toLowerCase() === h,
    ),
  );
  if (exact.length > 0 || h.length < 2) return exact;
  return people.filter((p) =>
    p.name
      .toLowerCase()
      .split(/\s+/)
      .some((word) => word.startsWith(h)),
  );
}

async function knownPeople(projectIds: string[]): Promise<Person[]> {
  if (projectIds.length === 0) return [];
  const [owners, members] = await Promise.all([
    db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(project)
      .innerJoin(userTable, eq(userTable.id, project.ownerId))
      .where(inArray(project.id, projectIds)),
    db
      .select({ id: userTable.id, name: userTable.name, email: userTable.email })
      .from(projectMember)
      .innerJoin(userTable, eq(userTable.id, projectMember.userId))
      .where(inArray(projectMember.projectId, projectIds)),
  ]);
  return [...new Map([...owners, ...members].map((p) => [p.id, p])).values()];
}

function resolvePerson(
  people: Person[],
  hint: string,
  selfId: string,
  role: "createdBy" | "assignee",
): Person {
  const h = hint.trim().toLowerCase();
  if (h === "me") {
    const self = people.find((p) => p.id === selfId);
    if (self) return self;
  }
  const found = matchPeople(people, hint);
  if (found.length === 1) return found[0]!;
  if (found.length > 1) {
    throw new McpUserError(
      `"${hint}" (${role}) matches several people: ${found.map((p) => p.name).join(", ")}. Ask the user which one, then pass the full name.`,
    );
  }
  throw new McpUserError(
    `No project member matches "${hint}" (${role}). Known people: ${people.map((p) => p.name).join(", ") || "none"}.`,
  );
}

/** Ad-hoc read-only task lookup for rough questions about the boards. */
export function registerFindTools(server: McpServer, auth: McpAuthorization) {
  server.registerTool(
    "find_tasks",
    {
      title: "Find tasks",
      description:
        'Answer questions about tasks across the user\'s projects, e.g. "what did Asha add last week" or "open bugs assigned to me". All filters are optional and combine with AND. People are matched loosely by name or email; "me" means the user. Read-only.',
      inputSchema: {
        projectId: z.string().min(1).optional(),
        text: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Substring of the title or description."),
        createdBy: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe('Who added the task: "me", a name, or an email.'),
        assignee: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe('"me", "none" for unassigned, a name, or an email.'),
        createdWithinDays: z
          .number()
          .int()
          .min(1)
          .max(366)
          .optional()
          .describe('Created in the last N days; "last week" = 7.'),
        createdAfter: z
          .string()
          .date()
          .optional()
          .describe("Created on or after this UTC date (YYYY-MM-DD)."),
        createdBefore: z
          .string()
          .date()
          .optional()
          .describe("Created before this UTC date (YYYY-MM-DD), exclusive."),
        status: z
          .array(z.enum(columnCategory.enumValues))
          .min(1)
          .optional()
          .describe(
            "Column categories to include; omit for all. Open work = unstarted + started.",
          ),
        priority: z.array(z.enum(taskPriority.enumValues)).min(1).optional(),
        label: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .optional()
          .describe("Label name, case-insensitive."),
        limit: z.number().int().min(1).max(100).optional(),
      },
      outputSchema: {
        todayUtc: z.string(),
        resolved: z.object({
          createdBy: personRef.nullable(),
          assignee: personRef.nullable(),
          createdFrom: z.string().nullable(),
        }),
        truncated: z.boolean(),
        tasks: z.array(
          z.object({
            id: z.string(),
            identifier: z.string(),
            title: z.string(),
            project: z.string(),
            column: z.string(),
            status: z.string(),
            priority: z.string(),
            createdBy: z.string(),
            assignee: z.string().nullable(),
            createdAt: z.string(),
            dueAt: z.string().nullable(),
            url: z.string().url(),
          }),
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        const caller = await createMcpCaller(auth.userId);
        const projects = await caller.project.list();
        const scope = input.projectId
          ? projects.filter((p) => p.id === input.projectId)
          : projects;
        if (input.projectId && scope.length === 0) {
          throw new McpUserError("Project not found or not accessible.");
        }
        const projectIds = scope.map((p) => p.id);

        const needsPeople =
          input.createdBy !== undefined ||
          (input.assignee !== undefined &&
            input.assignee.toLowerCase() !== "none");
        const people = needsPeople ? await knownPeople(projectIds) : [];
        const createdBy = input.createdBy
          ? resolvePerson(people, input.createdBy, auth.userId, "createdBy")
          : null;
        const unassigned = input.assignee?.toLowerCase() === "none";
        const assignee =
          input.assignee && !unassigned
            ? resolvePerson(people, input.assignee, auth.userId, "assignee")
            : null;

        const now = new Date();
        const from = [
          input.createdWithinDays
            ? new Date(now.getTime() - input.createdWithinDays * DAY_MS)
            : null,
          input.createdAfter ? startOfDayUtc(input.createdAfter) : null,
        ]
          .filter((d): d is Date => d !== null)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const limit = input.limit ?? 25;

        const reporter = alias(userTable, "reporter");
        const assigneeUser = alias(userTable, "assignee_user");
        const term = input.text ? `%${escapeLike(input.text)}%` : null;

        const rows =
          projectIds.length === 0
            ? []
            : await db
                .select({
                  id: task.id,
                  number: task.number,
                  title: task.title,
                  priority: task.priority,
                  createdAt: task.createdAt,
                  dueAt: task.dueAt,
                  column: boardColumn.name,
                  status: boardColumn.category,
                  projectKey: project.key,
                  projectSlug: project.slug,
                  projectName: project.name,
                  createdBy: reporter.name,
                  assignee: assigneeUser.name,
                })
                .from(task)
                .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
                .innerJoin(board, eq(board.id, task.boardId))
                .innerJoin(project, eq(project.id, board.projectId))
                .innerJoin(reporter, eq(reporter.id, task.reporterId))
                .leftJoin(assigneeUser, eq(assigneeUser.id, task.assigneeId))
                .where(
                  and(
                    inArray(project.id, projectIds),
                    isNull(task.archivedAt),
                    createdBy ? eq(task.reporterId, createdBy.id) : undefined,
                    unassigned ? isNull(task.assigneeId) : undefined,
                    assignee ? eq(task.assigneeId, assignee.id) : undefined,
                    from ? gte(task.createdAt, from) : undefined,
                    input.createdBefore
                      ? lt(task.createdAt, startOfDayUtc(input.createdBefore))
                      : undefined,
                    input.status
                      ? inArray(boardColumn.category, input.status)
                      : undefined,
                    input.priority
                      ? inArray(task.priority, input.priority)
                      : undefined,
                    term
                      ? or(ilike(task.title, term), ilike(task.description, term))
                      : undefined,
                    input.label
                      ? inArray(
                          task.id,
                          db
                            .select({ id: taskLabel.taskId })
                            .from(taskLabel)
                            .innerJoin(label, eq(label.id, taskLabel.labelId))
                            .where(
                              sql`lower(${label.name}) = ${input.label.toLowerCase()}`,
                            ),
                        )
                      : undefined,
                  ),
                )
                .orderBy(desc(task.createdAt))
                .limit(limit + 1);

        const tasks = rows.slice(0, limit).map((r) => {
          const url = new URL(`/app/p/${r.projectSlug}`, MCP_ORIGIN);
          url.searchParams.set("task", r.id);
          return {
            id: r.id,
            identifier: `${r.projectKey}-${r.number}`,
            title: r.title,
            project: r.projectName,
            column: r.column,
            status: r.status,
            priority: r.priority,
            createdBy: r.createdBy,
            assignee: r.assignee,
            createdAt: r.createdAt.toISOString(),
            dueAt: r.dueAt ? day(r.dueAt) : null,
            url: url.toString(),
          };
        });

        const ref = (p: Person | null) => (p ? { id: p.id, name: p.name } : null);
        return ok({
          todayUtc: day(now),
          resolved: {
            createdBy: ref(createdBy),
            assignee: ref(assignee),
            createdFrom: from ? from.toISOString() : null,
          },
          truncated: rows.length > limit,
          tasks,
        });
      } catch (err) {
        return toFailure(err);
      }
    },
  );
}
