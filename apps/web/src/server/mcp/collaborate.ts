import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { buildAttachmentKey, headObject, presignUpload } from "@/lib/r2";
import { db } from "@/server/db";
import {
  checklistItem,
  comment,
  label,
  taskAttachment,
  taskLabel,
} from "@/server/db/schema";

import { agentClientOf } from "./agent-note";
import type { McpAuthorization } from "./authorization";
import { createMcpCaller } from "./caller";
import { McpUserError, ok, toFailure } from "./result";
import {
  agentCommentBody,
  assertMine,
  assertOpen,
  type Caller,
  clientName,
  commentBodyInput,
  firstColumn,
  moveToEnd,
  postAgentComment,
  resolveTask,
  taskRefInput,
  taskUrl,
  writeHints,
} from "./task-ref";

const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
const UPLOAD_TTL_SECONDS = 10 * 60;

const checklistOutput = z.array(
  z.object({ id: z.string(), text: z.string(), done: z.boolean() }),
);

async function loadChecklist(taskId: string) {
  return db
    .select({
      id: checklistItem.id,
      text: checklistItem.text,
      done: checklistItem.done,
    })
    .from(checklistItem)
    .where(eq(checklistItem.taskId, taskId))
    .orderBy(asc(checklistItem.position));
}

/** Loads one of the user's agent comments posted by this same client. */
async function ownAgentComment(
  caller: Caller,
  auth: McpAuthorization,
  commentId: string,
) {
  const [row] = await db
    .select({
      id: comment.id,
      authorId: comment.authorId,
      body: comment.body,
      taskId: comment.taskId,
    })
    .from(comment)
    .where(eq(comment.id, commentId))
    .limit(1);
  if (!row || row.authorId !== auth.userId) {
    throw new McpUserError(`Comment ${commentId} not found.`);
  }
  if (agentClientOf(row.body) !== (await clientName(auth.clientId))) {
    throw new McpUserError(
      "Only comments this agent posted can be changed. Leave people's comments alone.",
    );
  }
  // resolveTask re-checks project access as the user
  const t = await resolveTask(caller, row.taskId);
  return { comment: row, task: t };
}

/** Write tools for recording results on the user's own tasks. */
export function registerCollaborationTools(
  server: McpServer,
  auth: McpAuthorization,
) {
  async function run(
    fn: (caller: Caller) => Promise<CallToolResult>,
  ): Promise<CallToolResult> {
    try {
      return await fn(await createMcpCaller(auth.userId));
    } catch (err) {
      return toFailure(err);
    }
  }

  server.registerTool(
    "comment_on_task",
    {
      title: "Comment on my task",
      description:
        "Post one agent-marked comment on a task assigned to the user, as the user. Use it for findings the reporter needs (root cause, a decision you made, a question). Do not narrate progress; finish_task and report_blocker already post their own notes. Notifies the reporter.",
      inputSchema: { task: taskRefInput, body: commentBodyInput },
      outputSchema: {
        commentId: z.string(),
        identifier: z.string(),
        url: z.string().url(),
      },
      annotations: { ...writeHints, idempotentHint: false },
    },
    async ({ task: ref, body }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        const commentId = await postAgentComment(
          caller,
          t,
          auth.userId,
          await agentCommentBody(body, auth.clientId),
        );
        return ok({
          commentId,
          identifier: t.identifier,
          url: taskUrl(t.projectSlug, t.id),
        });
      }),
  );

  server.registerTool(
    "report_blocker",
    {
      title: "Report blocker",
      description:
        "When you cannot finish one of the user's tasks: post an agent-marked comment with the specific blocker or question, and move an in-progress task back to the board's first to-do column (backlog if none) so it is not stuck in progress. Notifies the reporter.",
      inputSchema: {
        task: taskRefInput,
        reason: commentBodyInput.describe(
          "Markdown: what blocks you and the exact decision or access needed. Include what you already tried or found.",
        ),
        moveBack: z
          .boolean()
          .optional()
          .describe("Default true. False keeps the task in its column."),
      },
      outputSchema: {
        status: z.literal("blocked"),
        identifier: z.string(),
        column: z.string(),
        moved: z.boolean(),
        commentId: z.string(),
        url: z.string().url(),
        note: z.string().optional(),
      },
      annotations: { ...writeHints, idempotentHint: false },
    },
    async ({ task: ref, reason, moveBack = true }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        assertOpen(t);

        const commentId = await postAgentComment(
          caller,
          t,
          auth.userId,
          await agentCommentBody(`**Blocked:** ${reason}`, auth.clientId),
        );

        const target =
          moveBack && t.category === "started"
            ? ((await firstColumn(t.boardId, "unstarted")) ??
              (await firstColumn(t.boardId, "backlog")))
            : null;
        let note: string | undefined;
        if (target) {
          try {
            await moveToEnd(caller, t, target.id);
          } catch (err) {
            if (!(err instanceof McpUserError)) throw err;
            note = `Comment posted, but the task was not moved: ${err.message}`;
          }
        }
        const moved = Boolean(target) && !note;

        return ok({
          status: "blocked",
          identifier: t.identifier,
          column: moved ? target!.name : t.columnName,
          moved,
          commentId,
          url: taskUrl(t.projectSlug, t.id),
          ...(note ? { note } : {}),
        });
      }),
  );

  server.registerTool(
    "update_checklist",
    {
      title: "Update my task's checklist",
      description:
        "On a task assigned to the user: tick items you completed, untick items you wrongly ticked, or add sub-steps you discovered that someone must still do. Use ids from get_task. Do not add items for work you already finished.",
      inputSchema: {
        task: taskRefInput,
        complete: z.array(z.string().min(1)).max(50).optional(),
        reopen: z.array(z.string().min(1)).max(50).optional(),
        add: z.array(z.string().trim().min(1).max(280)).max(10).optional(),
      },
      outputSchema: { identifier: z.string(), checklist: checklistOutput },
      annotations: writeHints,
    },
    async ({ task: ref, complete = [], reopen = [], add = [] }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        assertOpen(t);

        const items = await loadChecklist(t.id);
        const known = new Map(items.map((i) => [i.id, i]));
        const unknown = [...complete, ...reopen].filter((id) => !known.has(id));
        if (unknown.length > 0) {
          throw new McpUserError(
            `Checklist ids not on ${t.identifier}: ${unknown.join(", ")}`,
          );
        }
        const both = complete.filter((id) => reopen.includes(id));
        if (both.length > 0) {
          throw new McpUserError(
            `Ids in both complete and reopen: ${both.join(", ")}`,
          );
        }

        for (const [ids, done] of [
          [complete, true],
          [reopen, false],
        ] as const) {
          for (const id of new Set(ids)) {
            if (known.get(id)!.done === done) continue;
            await caller.checklist.toggle({
              boardId: t.boardId,
              itemId: id,
              done,
            });
          }
        }
        const existing = new Set(items.map((i) => i.text.trim().toLowerCase()));
        for (const text of add) {
          if (existing.has(text.toLowerCase())) continue;
          existing.add(text.toLowerCase());
          await caller.checklist.add({
            boardId: t.boardId,
            taskId: t.id,
            text,
          });
        }

        return ok({
          identifier: t.identifier,
          checklist: await loadChecklist(t.id),
        });
      }),
  );

  server.registerTool(
    "set_task_labels",
    {
      title: "Set labels on my task",
      description:
        "Add or remove existing board labels (by name) on a task assigned to the user, e.g. needs-review. Cannot create labels.",
      inputSchema: {
        task: taskRefInput,
        add: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
        remove: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
      },
      outputSchema: { identifier: z.string(), labels: z.array(z.string()) },
      annotations: writeHints,
    },
    async ({ task: ref, add = [], remove = [] }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);

        const labels = await db
          .select({ id: label.id, name: label.name })
          .from(label)
          .where(eq(label.boardId, t.boardId));
        const byName = new Map(labels.map((l) => [l.name.toLowerCase(), l]));
        const missing = [...add, ...remove].filter(
          (n) => !byName.has(n.toLowerCase()),
        );
        if (missing.length > 0) {
          throw new McpUserError(
            `No label named ${missing.map((n) => `"${n}"`).join(", ")} on this board. Available: ${labels.map((l) => l.name).join(", ") || "none"}. Ask the user to create it.`,
          );
        }

        for (const [names, on] of [
          [add, true],
          [remove, false],
        ] as const) {
          for (const name of names) {
            await caller.label.setOnTask({
              boardId: t.boardId,
              taskId: t.id,
              labelId: byName.get(name.toLowerCase())!.id,
              on,
            });
          }
        }

        const rows = await db
          .select({ name: label.name })
          .from(taskLabel)
          .innerJoin(label, eq(label.id, taskLabel.labelId))
          .where(eq(taskLabel.taskId, t.id));
        return ok({
          identifier: t.identifier,
          labels: rows.map((r) => r.name),
        });
      }),
  );

  server.registerTool(
    "add_attachment",
    {
      title: "Start an attachment upload",
      description:
        "Step 1 of 2 for attaching a file (screenshot, log) to a task assigned to the user. Returns a short-lived upload url; PUT the file bytes there with the exact Content-Type (curl command included), then call confirm_attachment. Only attach files that help the reporter verify the fix; never attach secrets or .env files.",
      inputSchema: {
        task: taskRefInput,
        filename: z.string().trim().min(1).max(160),
        mime: z
          .string()
          .trim()
          .regex(/^[\w.+-]+\/[\w.+-]+$/, "Must be a MIME type like image/png")
          .max(100),
        sizeBytes: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
      },
      outputSchema: {
        key: z.string(),
        uploadUrl: z.string().url(),
        method: z.literal("PUT"),
        headers: z.record(z.string()),
        expiresInSeconds: z.number().int(),
        curl: z.string(),
      },
      annotations: { ...writeHints, openWorldHint: true },
    },
    // sizeBytes is only validated up front; confirm_attachment reads the real size
    async ({ task: ref, filename, mime }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        const key = buildAttachmentKey({ taskId: t.id, filename });
        let uploadUrl: string;
        try {
          uploadUrl = await presignUpload({
            key,
            contentType: mime,
            expiresIn: UPLOAD_TTL_SECONDS,
          });
        } catch {
          throw new McpUserError(
            "Attachments are not configured on this Kanbi server.",
          );
        }
        return ok({
          key,
          uploadUrl,
          method: "PUT",
          headers: { "Content-Type": mime },
          expiresInSeconds: UPLOAD_TTL_SECONDS,
          curl: `curl -fsS -X PUT -H 'Content-Type: ${mime}' --data-binary @<path-to-file> '${uploadUrl}'`,
        });
      }),
  );

  server.registerTool(
    "confirm_attachment",
    {
      title: "Confirm an attachment upload",
      description:
        "Step 2 of 2: after the PUT succeeded, register the uploaded file on the task so people see it. Safe to repeat.",
      inputSchema: {
        task: taskRefInput,
        key: z.string().min(1).max(400).describe("key from add_attachment."),
        filename: z.string().trim().min(1).max(160),
      },
      outputSchema: {
        attachmentId: z.string(),
        identifier: z.string(),
        sizeBytes: z.number().int(),
        url: z.string().url(),
      },
      annotations: writeHints,
    },
    async ({ task: ref, key, filename }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        if (!key.startsWith(`attachments/${t.id}/`) || key.includes("..")) {
          throw new McpUserError(
            `That key does not belong to ${t.identifier}; call add_attachment for this task.`,
          );
        }

        const [existing] = await db
          .select({
            id: taskAttachment.id,
            sizeBytes: taskAttachment.sizeBytes,
          })
          .from(taskAttachment)
          .where(eq(taskAttachment.key, key))
          .limit(1);
        const url = taskUrl(t.projectSlug, t.id);
        if (existing) {
          return ok({
            attachmentId: existing.id,
            identifier: t.identifier,
            sizeBytes: existing.sizeBytes,
            url,
          });
        }

        const head = await headObject(key);
        if (!head || head.sizeBytes === 0) {
          throw new McpUserError(
            "No uploaded file at that key yet. Run the PUT from add_attachment first (the url expires after 10 minutes).",
          );
        }
        if (head.sizeBytes > MAX_ATTACHMENT_BYTES) {
          throw new McpUserError("File is larger than the 25 MB limit.");
        }

        const row = await caller.attachment.create({
          boardId: t.boardId,
          taskId: t.id,
          key,
          filename,
          mime: head.contentType ?? "application/octet-stream",
          sizeBytes: head.sizeBytes,
        });
        if (!row) throw new Error("attachment insert returned nothing");
        return ok({
          attachmentId: row.id,
          identifier: t.identifier,
          sizeBytes: head.sizeBytes,
          url,
        });
      }),
  );

  server.registerTool(
    "edit_comment",
    {
      title: "Edit my agent comment",
      description:
        "Correct a comment this agent posted (ids come from get_task agentComments or the tool that posted it). Cannot touch comments people wrote.",
      inputSchema: { commentId: z.string().min(1), body: commentBodyInput },
      outputSchema: { commentId: z.string(), identifier: z.string() },
      annotations: writeHints,
    },
    async ({ commentId, body }) =>
      run(async (caller) => {
        const { task: t } = await ownAgentComment(caller, auth, commentId);
        await caller.comment.edit({
          boardId: t.boardId,
          commentId,
          body: await agentCommentBody(body, auth.clientId),
        });
        return ok({ commentId, identifier: t.identifier });
      }),
  );

  server.registerTool(
    "delete_comment",
    {
      title: "Delete my agent comment",
      description:
        "Delete a comment this agent posted by mistake. Cannot touch comments people wrote.",
      inputSchema: { commentId: z.string().min(1) },
      outputSchema: { deleted: z.literal(true), identifier: z.string() },
      annotations: { ...writeHints, destructiveHint: true },
    },
    async ({ commentId }) =>
      run(async (caller) => {
        const { task: t } = await ownAgentComment(caller, auth, commentId);
        await caller.comment.delete({ boardId: t.boardId, commentId });
        return ok({ deleted: true, identifier: t.identifier });
      }),
  );
}
