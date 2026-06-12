import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, asc, eq } from "drizzle-orm";
import type { JWTPayload } from "jose";
import { z } from "zod";

import { resolveBoardAccess } from "@/server/api/permissions";
import { db } from "@/server/db";
import {
  board,
  boardColumn,
  label,
  project,
  projectMember,
  taskPriority,
  user as userTable,
} from "@/server/db/schema";

import { createMcpCaller } from "./caller";
import { SCOPE_READ, SCOPE_WRITE } from "./config";
import { sanitizeRichText } from "./sanitize";

// ── helpers ──────────────────────────────────────────────────────────────────

type TextResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (data: unknown): TextResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const fail = (message: string): TextResult => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

function scopesOf(jwt: JWTPayload): string[] {
  const raw = (jwt as Record<string, unknown>).scopes ?? jwt.scope;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return raw.split(/\s+/).filter(Boolean);
  return [];
}

function errMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

const PRIORITIES = taskPriority.enumValues; // urgent | high | medium | low | none
const priorityEnum = z.enum(PRIORITIES);

/**
 * Registers all MCP tools on the server. Each tool is a thin wrapper over an
 * existing tRPC procedure: it checks the required scope from the verified JWT,
 * builds a caller acting as the token subject, and calls through - so input
 * validation, per-board/project ACLs, and realtime emission are all reused.
 */
export function registerTools(server: McpServer, jwt: JWTPayload) {
  const userId = jwt.sub;

  /** Scope-check → build caller → run → JSON, with errors surfaced to the agent. */
  async function run(
    scope: string,
    fn: (
      caller: Awaited<ReturnType<typeof createMcpCaller>>,
    ) => Promise<unknown>,
  ): Promise<TextResult> {
    try {
      if (!userId) return fail("Token has no subject (sub) claim.");
      if (!scopesOf(jwt).includes(scope)) {
        return fail(`Forbidden: this token is missing the "${scope}" scope.`);
      }
      const caller = await createMcpCaller(userId);
      return ok(await fn(caller));
    } catch (err) {
      return fail(errMessage(err));
    }
  }

  // ── read tools (kanbi:read) ────────────────────────────────────────────────

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List the projects the authenticated user can access.",
      inputSchema: {},
    },
    async () => run(SCOPE_READ, (caller) => caller.project.list()),
  );

  server.registerTool(
    "list_boards",
    {
      title: "List boards",
      description: "List all boards across the user's projects.",
      inputSchema: {},
    },
    async () => run(SCOPE_READ, (caller) => caller.focus.listBoards()),
  );

  server.registerTool(
    "get_board",
    {
      title: "Get board",
      description:
        "Get a board's full contents: columns and their tasks, plus labels.",
      inputSchema: { boardId: z.string().min(1) },
    },
    async ({ boardId }) =>
      run(SCOPE_READ, (caller) => caller.board.get({ boardId })),
  );

  server.registerTool(
    "search_tasks",
    {
      title: "Search tasks",
      description: "Full-text search across tasks the user can access.",
      inputSchema: {
        query: z.string().trim().min(1).max(100),
        limit: z.number().int().min(1).max(20).optional(),
      },
    },
    async ({ query, limit }) =>
      run(SCOPE_READ, (caller) => caller.task.search({ query, limit })),
  );

  server.registerTool(
    "get_board_context",
    {
      title: "Get board authoring context",
      description:
        "Everything needed to author good tasks for a board: project name, " +
        "description and systemPrompt (the project's task-writing conventions), " +
        "the board's labels and columns (with ids), assignable members (with " +
        "ids), the valid priority values, and today's date. Use the returned " +
        "ids verbatim when creating tasks.",
      inputSchema: { boardId: z.string().min(1) },
    },
    async ({ boardId }) => {
      try {
        if (!userId) return fail("Token has no subject (sub) claim.");
        if (!scopesOf(jwt).includes(SCOPE_READ)) {
          return fail(
            `Forbidden: this token is missing the "${SCOPE_READ}" scope.`,
          );
        }
        // Enforce board membership with the same gate the tRPC procedures use.
        const access = await resolveBoardAccess({ db, userId, boardId });
        if (!access) return fail("Board not found or access denied.");

        const [proj] = await db
          .select({
            id: project.id,
            name: project.name,
            description: project.description,
            systemPrompt: project.systemPrompt,
          })
          .from(board)
          .innerJoin(project, eq(project.id, board.projectId))
          .where(eq(board.id, boardId))
          .limit(1);
        if (!proj) return fail("Board not found.");

        const [labels, columns, members] = await Promise.all([
          db
            .select({ id: label.id, name: label.name, color: label.color })
            .from(label)
            .where(eq(label.boardId, boardId)),
          db
            .select({ id: boardColumn.id, name: boardColumn.name })
            .from(boardColumn)
            .where(eq(boardColumn.boardId, boardId))
            .orderBy(asc(boardColumn.position)),
          db
            .select({ id: userTable.id, name: userTable.name })
            .from(projectMember)
            .innerJoin(userTable, eq(userTable.id, projectMember.userId))
            .where(eq(projectMember.projectId, proj.id)),
        ]);

        return ok({
          project: {
            name: proj.name,
            description: proj.description,
            systemPrompt: proj.systemPrompt,
          },
          columns,
          labels,
          members,
          priorities: PRIORITIES,
          todayUtc: new Date().toISOString().slice(0, 10),
        });
      } catch (err) {
        return fail(errMessage(err));
      }
    },
  );

  // ── write tools (kanbi:write) ──────────────────────────────────────────────

  server.registerTool(
    "create_tasks",
    {
      title: "Create tasks",
      description:
        "Create one or more tasks on a board. Use column/label/assignee ids " +
        "from get_board_context. dueAt is a YYYY-MM-DD date. Description is " +
        "simple HTML (<p>, <strong>, <em>, <code>, <a>, <ul>/<ol>/<li>).",
      inputSchema: {
        boardId: z.string().min(1),
        tasks: z
          .array(
            z.object({
              columnId: z.string().min(1),
              title: z.string().min(1).max(200),
              description: z.string().max(10_000).optional(),
              priority: priorityEnum.optional(),
              labelIds: z.array(z.string()).optional(),
              assigneeId: z.string().nullable().optional(),
              dueAt: z.string().date().nullable().optional(),
              checklist: z.array(z.string().min(1).max(280)).max(20).optional(),
            }),
          )
          .min(1)
          .max(20),
      },
    },
    async ({ boardId, tasks }) =>
      run(SCOPE_WRITE, (caller) =>
        caller.task.createMany({
          boardId,
          tasks: tasks.map((t) => ({
            columnId: t.columnId,
            title: t.title,
            // Agent-authored HTML: re-impose the editor's allowlist server-side.
            description:
              t.description === undefined
                ? undefined
                : sanitizeRichText(t.description),
            priority: t.priority,
            labelIds: t.labelIds,
            assigneeId: t.assigneeId ?? undefined,
            dueAt: t.dueAt ? new Date(t.dueAt) : undefined,
            checklist: t.checklist,
          })),
        }),
      ),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        "Update fields on a task. Only provided fields change. Pass null to " +
        "clear assignee/dueAt/description. dueAt is YYYY-MM-DD.",
      inputSchema: {
        boardId: z.string().min(1),
        taskId: z.string().min(1),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(10_000).nullable().optional(),
        priority: priorityEnum.optional(),
        assigneeId: z.string().nullable().optional(),
        dueAt: z.string().date().nullable().optional(),
      },
    },
    async ({ boardId, taskId, dueAt, description, ...rest }) =>
      run(SCOPE_WRITE, (caller) =>
        caller.task.update({
          boardId,
          taskId,
          ...rest,
          // null clears, undefined leaves unchanged; sanitize a provided value.
          description:
            description == null ? description : sanitizeRichText(description),
          dueAt:
            dueAt === undefined
              ? undefined
              : dueAt === null
                ? null
                : new Date(dueAt),
        }),
      ),
  );

  server.registerTool(
    "add_comment",
    {
      title: "Add comment",
      description: "Add a comment to a task.",
      inputSchema: {
        boardId: z.string().min(1),
        taskId: z.string().min(1),
        body: z.string().min(1).max(10_000),
      },
    },
    async ({ boardId, taskId, body }) => {
      const clean = sanitizeRichText(body);
      if (!clean.trim()) return fail("Comment body is empty after sanitizing.");
      return run(SCOPE_WRITE, (caller) =>
        caller.comment.create({ boardId, taskId, body: clean }),
      );
    },
  );
}
