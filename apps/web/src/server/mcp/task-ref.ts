import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { z } from "zod";

import { markdownToHtml } from "@/lib/markdown-to-html";
import { db } from "@/server/db";
import {
  board,
  boardColumn,
  comment,
  oauthClient,
  project,
  task,
} from "@/server/db/schema";
import { sanitizeRichText } from "@/server/rich-text/sanitize";

import { agentFooter } from "./agent-note";
import type { createMcpCaller } from "./caller";
import { MCP_ORIGIN } from "./config";
import { McpUserError } from "./result";
import { parseIdentifier } from "./work-queue";

export type Caller = Awaited<ReturnType<typeof createMcpCaller>>;

export const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const writeHints = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

export const taskRefInput = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .describe('Ticket identifier like "KAN-42", or the task id.');

export function taskUrl(projectSlug: string, taskId: string): string {
  const url = new URL(`/app/p/${projectSlug}`, MCP_ORIGIN);
  url.searchParams.set("task", taskId);
  return url.toString();
}

export function docUrl(projectSlug: string, documentId: string): string {
  return new URL(
    `/app/p/${projectSlug}/docs/${documentId}`,
    MCP_ORIGIN,
  ).toString();
}

export async function resolveTask(caller: Caller, ref: string) {
  const projects = await caller.project.list();
  const parsed = parseIdentifier(ref);
  const projectIds = (
    parsed
      ? projects.filter((p) => p.key.toUpperCase() === parsed.key)
      : projects
  ).map((p) => p.id);
  if (projectIds.length === 0) throw new McpUserError(`Task ${ref} not found.`);

  const rows = await db
    .select({
      id: task.id,
      number: task.number,
      title: task.title,
      description: task.description,
      sourceText: task.sourceText,
      priority: task.priority,
      dueAt: task.dueAt,
      assigneeId: task.assigneeId,
      reporterId: task.reporterId,
      boardId: task.boardId,
      columnId: task.columnId,
      columnName: boardColumn.name,
      category: boardColumn.category,
      projectId: project.id,
      projectKey: project.key,
      projectSlug: project.slug,
      projectName: project.name,
      guidance: project.systemPrompt,
    })
    .from(task)
    .innerJoin(boardColumn, eq(boardColumn.id, task.columnId))
    .innerJoin(board, eq(board.id, task.boardId))
    .innerJoin(project, eq(project.id, board.projectId))
    .where(
      and(
        inArray(project.id, projectIds),
        isNull(task.archivedAt),
        parsed ? eq(task.number, parsed.number) : eq(task.id, ref),
      ),
    )
    .limit(2);

  if (rows.length === 0) throw new McpUserError(`Task ${ref} not found.`);
  if (rows.length > 1) {
    throw new McpUserError(
      `${ref} is ambiguous across projects; pass the task id from get_work_queue.`,
    );
  }
  const row = rows[0]!;
  return { ...row, identifier: `${row.projectKey}-${row.number}` };
}

export type ResolvedTask = Awaited<ReturnType<typeof resolveTask>>;

export function assertMine(t: ResolvedTask, userId: string) {
  if (t.assigneeId !== userId) {
    throw new McpUserError(
      `${t.identifier} is not assigned to the user. Leave it alone.`,
    );
  }
}

export function assertOpen(t: ResolvedTask) {
  if (t.category === "completed" || t.category === "canceled") {
    throw new McpUserError(`${t.identifier} is already closed.`);
  }
}

export async function firstColumn(
  boardId: string,
  category: "unstarted" | "backlog" | "started" | "completed",
) {
  const [col] = await db
    .select({ id: boardColumn.id, name: boardColumn.name })
    .from(boardColumn)
    .where(
      and(eq(boardColumn.boardId, boardId), eq(boardColumn.category, category)),
    )
    .orderBy(asc(boardColumn.position))
    .limit(1);
  return col ?? null;
}

export async function requireColumn(
  boardId: string,
  category: "started" | "completed",
) {
  const col = await firstColumn(boardId, category);
  if (!col) {
    throw new McpUserError(
      `This board has no ${category === "started" ? "in-progress" : "done"} column. Tell the user; do not move the task.`,
    );
  }
  return col;
}

export async function moveToEnd(
  caller: Caller,
  t: ResolvedTask,
  toColumnId: string,
) {
  const [last] = await db
    .select({ position: task.position })
    .from(task)
    .where(eq(task.columnId, toColumnId))
    .orderBy(desc(task.position))
    .limit(1);
  try {
    await caller.task.move({
      boardId: t.boardId,
      taskId: t.id,
      toColumnId,
      before: last?.position ?? null,
      after: null,
      expectedColumnId: t.columnId,
    });
  } catch (err) {
    if (err instanceof TRPCError && err.code === "CONFLICT") {
      throw new McpUserError(
        `${t.identifier} was moved by someone else meanwhile. Call get_work_queue again.`,
      );
    }
    throw err;
  }
}

export async function clientName(clientId: string): Promise<string> {
  const [row] = await db
    .select({ name: oauthClient.name })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .limit(1);
  return row?.name?.trim() || "AI agent";
}

export const commentBodyInput = z
  .string()
  .trim()
  .min(10)
  .max(8_000)
  .describe(
    "Markdown (paragraphs, lists, **bold**, `code`, links). Plain and specific; no filler.",
  );

/** Html body with the agent footer; sanitized like any other rich text. */
export async function agentCommentBody(markdown: string, clientId: string) {
  const html = sanitizeRichText(markdownToHtml(markdown)) || "<p></p>";
  return `${html}${agentFooter(await clientName(clientId))}`;
}

const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

/** Posts as the user; a retried identical call returns the earlier comment. */
export async function postAgentComment(
  caller: Caller,
  t: ResolvedTask,
  userId: string,
  body: string,
): Promise<string> {
  const [dupe] = await db
    .select({ id: comment.id })
    .from(comment)
    .where(
      and(
        eq(comment.taskId, t.id),
        eq(comment.authorId, userId),
        eq(comment.body, body),
        gt(comment.createdAt, new Date(Date.now() - DEDUPE_WINDOW_MS)),
      ),
    )
    .limit(1);
  if (dupe) return dupe.id;
  const row = await caller.comment.create({
    boardId: t.boardId,
    taskId: t.id,
    body,
  });
  if (!row) throw new Error("comment insert returned nothing");
  return row.id;
}
