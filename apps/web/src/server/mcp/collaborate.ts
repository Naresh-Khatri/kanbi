import "server-only";

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import type { AgentId } from "@/lib/agents";
import { extractFileIds, fileUrl, UPLOAD_REF_PREFIX } from "@/lib/file-url";
import {
  buildAttachmentKey,
  MAX_ATTACHMENT_BYTES,
  presignUpload,
} from "@/lib/r2";
import { recordActivity } from "@/server/activity/record";
import { db } from "@/server/db";
import {
  checklistItem,
  comment,
  label,
  taskAttachment,
  taskLabel,
} from "@/server/db/schema";

import type { McpAuthorization } from "./authorization";
import { agentIdentity, createMcpCaller } from "./caller";
import { docBodyFromMarkdown } from "./docs";
import { priorityEnum } from "./project-context";
import { McpUserError, ok, toFailure, userFacing } from "./result";
import { sanitizeRichText } from "./sanitize";
import {
  agentCommentBody,
  agentInput,
  assertMine,
  assertOpen,
  attachUploadRefs,
  type Caller,
  commentBodyInput,
  firstColumn,
  moveToEnd,
  postAgentComment,
  resolveTask,
  taskRefInput,
  taskUrl,
  writeHints,
} from "./task-ref";

const UPLOAD_TTL_SECONDS = 10 * 60;
const MAX_DESCRIPTION_HTML = 10_000;

const FILE_TAG_RE =
  /<img\b[^>]*?\bsrc="\/api\/files\/([A-Za-z0-9_-]+)"[^>]*>|<video\b[^>]*?\bsrc="\/api\/files\/([A-Za-z0-9_-]+)"[^>]*>(?:<\/video>)?/g;

/** Image/video tags in `before` whose file the new html dropped. */
function droppedFileTags(before: string, after: string): string[] {
  const kept = new Set(extractFileIds(after));
  const out = new Map<string, string>();
  for (const m of before.matchAll(FILE_TAG_RE)) {
    const id = (m[1] ?? m[2])!;
    if (!kept.has(id) && !out.has(id)) out.set(id, m[0]);
  }
  return [...out.values()];
}

// get_task's "[image 1 below: a.png]" / "[image a.png: https://…]" labels
const IMAGE_LABEL_RE =
  /\\?\[image (?:\d+ below: )?(.+?)(?:: https?:\/\/[^\s\]]+)?\\?\]/g;

/**
 * Swap image labels copied from get_task back to the original tags, in place.
 * Tokens survive markdown -> html; `restore` puts the tags in.
 */
async function relinkImageLabels(
  markdown: string,
  t: { id: string; description: string | null },
) {
  const ids = extractFileIds(t.description ?? "");
  const noop = { markdown, restore: (html: string) => html };
  if (ids.length === 0 || !/\[image /.test(markdown)) return noop;
  const rows = await db
    .select({ id: taskAttachment.id, filename: taskAttachment.filename })
    .from(taskAttachment)
    .where(
      and(eq(taskAttachment.taskId, t.id), inArray(taskAttachment.id, ids)),
    );
  const tags = new Map<string, string>();
  for (const m of (t.description ?? "").matchAll(FILE_TAG_RE)) {
    tags.set((m[1] ?? m[2])!, m[0]);
  }
  const byName = new Map(rows.map((r) => [r.filename, tags.get(r.id)]));
  const used: string[] = [];
  const out = markdown.replace(IMAGE_LABEL_RE, (match, raw: string) => {
    const tag = byName.get(raw.replace(/\\(.)/g, "$1"));
    if (!tag) return match;
    used.push(tag);
    return `KANBIFILETOKEN${used.length - 1}X`;
  });
  return {
    markdown: out,
    restore: (html: string) =>
      html.replace(
        /KANBIFILETOKEN(\d+)X/g,
        (m, i: string) => used[Number(i)] ?? m,
      ),
  };
}

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
      agentClientId: comment.agentClientId,
      taskId: comment.taskId,
    })
    .from(comment)
    .where(eq(comment.id, commentId))
    .limit(1);
  if (!row || row.authorId !== auth.userId) {
    throw new McpUserError(`Comment ${commentId} not found.`);
  }
  if (row.agentClientId !== auth.clientId) {
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
    agent?: AgentId,
  ): Promise<CallToolResult> {
    try {
      return await fn(await createMcpCaller(auth, agent));
    } catch (err) {
      return toFailure(err);
    }
  }

  server.registerTool(
    "assign_to_me",
    {
      title: "Assign task to me",
      description:
        "Assign an unassigned open task to the user, so the work tools can act on it. Use when the user asks you to work on or update a task nobody is assigned to. Never takes a task assigned to someone else; ask the user to reassign it in Kanbi instead. Safe to repeat.",
      inputSchema: { task: taskRefInput },
      outputSchema: {
        status: z.enum(["assigned", "already_mine"]),
        identifier: z.string(),
        url: z.string().url(),
      },
      annotations: writeHints,
    },
    async ({ task: ref }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        const url = taskUrl(t.projectSlug, t.number);
        if (t.assigneeId === auth.userId) {
          return ok({ status: "already_mine", identifier: t.identifier, url });
        }
        if (t.assigneeId) {
          throw new McpUserError(
            `${t.identifier} is assigned to someone else. Ask the user to reassign it in Kanbi.`,
          );
        }
        assertOpen(t);
        await caller.task
          .update({ boardId: t.boardId, taskId: t.id, assigneeId: auth.userId })
          .catch(userFacing);
        return ok({ status: "assigned", identifier: t.identifier, url });
      }),
  );

  server.registerTool(
    "comment_on_task",
    {
      title: "Comment on my task",
      description:
        "Post one agent-marked comment on a task assigned to the user, as the user. Use it for updates the reporter needs (what was wrong, what is fixed, a decision you made, a question). Readers are usually non-technical clients: plain language, no file names, code, or commands, and embed a screenshot or short video (add_attachment markdown) when the change is visible. Do not narrate progress; finish_task and report_blocker already post their own notes. Notifies the reporter.",
      inputSchema: {
        task: taskRefInput,
        body: commentBodyInput,
        agent: agentInput,
      },
      outputSchema: {
        commentId: z.string(),
        identifier: z.string(),
        url: z.string().url(),
      },
      annotations: { ...writeHints, idempotentHint: false },
    },
    async ({ task: ref, body, agent }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        const commentId = await postAgentComment(
          caller,
          t,
          auth,
          await agentCommentBody(body, caller, t),
        );
        return ok({
          commentId,
          identifier: t.identifier,
          url: taskUrl(t.projectSlug, t.number),
        });
      }, agent),
  );

  server.registerTool(
    "report_blocker",
    {
      title: "Report blocker",
      description:
        "When you cannot finish one of the user's tasks: post an agent-marked comment with the specific blocker or question, and move an in-progress task back to the board's first to-do column (backlog if none) so it is not stuck in progress. Notifies the reporter. get_work_queue then lists the task under waitingOnPeople until a person comments or edits it.",
      inputSchema: {
        task: taskRefInput,
        reason: commentBodyInput.describe(
          "Markdown for a non-technical client: what blocks you and the exact decision or access needed, asked as a question they can answer without knowing the code. Briefly say what you already tried or found, in plain words.",
        ),
        moveBack: z
          .boolean()
          .optional()
          .describe("Default true. False keeps the task in its column."),
        agent: agentInput,
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
    async ({ task: ref, reason, moveBack = true, agent }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        assertOpen(t);

        const commentId = await postAgentComment(
          caller,
          t,
          auth,
          await agentCommentBody(`**Blocked:** ${reason}`, caller, t),
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
        // get_work_queue skips the task until a person responds; the board flags it
        await recordActivity(
          {
            db,
            session: { user: { id: auth.userId } },
            agent: await agentIdentity(auth.clientId, agent),
          },
          {
            boardId: t.boardId,
            taskId: t.id,
            verb: "task.blocked",
            payload: { commentId },
          },
        );

        return ok({
          status: "blocked",
          identifier: t.identifier,
          column: moved ? target!.name : t.columnName,
          moved,
          commentId,
          url: taskUrl(t.projectSlug, t.number),
          ...(note ? { note } : {}),
        });
      }, agent),
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
        "Attach a file (screenshot, log) to a task assigned to the user. Returns a short-lived upload url; PUT the file bytes there with the exact Content-Type (curl command included). Then paste the returned markdown into a finish_task / comment_on_task / report_blocker body to embed it, which also records the attachment; call confirm_attachment only to attach without embedding. For visible changes, attach a screenshot of the fixed screen by default (and the broken one, if you have it); use a short mp4 or webm video instead when the fix involves motion or several steps. Embedded .mp4/.webm files play inline. Only attach files that help the reporter see the fix; never attach secrets, .env files, or screens showing credentials.",
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
        markdown: z
          .string()
          .describe(
            "After the PUT, put this in a comment_on_task / finish_task / report_blocker body to show the image inline; no confirm_attachment needed.",
          ),
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
          markdown: `![${filename.replace(/[[\]]/g, "")}](${UPLOAD_REF_PREFIX}${key})`,
        });
      }),
  );

  server.registerTool(
    "confirm_attachment",
    {
      title: "Confirm an attachment upload",
      description:
        "Step 2 of 2: after the PUT succeeded, register the uploaded file on the task so people see it. Safe to repeat. Optional: comment bodies can embed the image directly with the markdown from add_attachment, which confirms it for you.",
      inputSchema: {
        task: taskRefInput,
        key: z.string().min(1).max(400).describe("key from add_attachment."),
        filename: z.string().trim().min(1).max(160),
      },
      outputSchema: {
        attachmentId: z.string(),
        identifier: z.string(),
        sizeBytes: z.number().int(),
        markdown: z
          .string()
          .describe(
            "Image embed for comment_on_task / finish_task / report_blocker bodies.",
          ),
        url: z.string().url(),
      },
      annotations: writeHints,
    },
    async ({ task: ref, key, filename }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        assertMine(t, auth.userId);
        const row = await caller.attachment
          .create({ boardId: t.boardId, taskId: t.id, key, filename })
          .catch(userFacing);
        return ok({
          attachmentId: row.id,
          identifier: t.identifier,
          sizeBytes: row.sizeBytes,
          markdown: `![${row.filename}](${fileUrl(row.id)})`,
          url: taskUrl(t.projectSlug, t.number),
        });
      }),
  );

  server.registerTool(
    "edit_comment",
    {
      title: "Edit my agent comment",
      description:
        "Correct a comment this agent posted (ids come from get_task agentComments or the tool that posted it). Cannot touch comments people wrote.",
      inputSchema: {
        commentId: z.string().min(1),
        body: commentBodyInput,
        agent: agentInput,
      },
      outputSchema: { commentId: z.string(), identifier: z.string() },
      annotations: writeHints,
    },
    async ({ commentId, body, agent }) =>
      run(async (caller) => {
        const { task: t } = await ownAgentComment(caller, auth, commentId);
        await caller.comment.edit({
          boardId: t.boardId,
          commentId,
          body: await agentCommentBody(body, caller, t),
        });
        return ok({ commentId, identifier: t.identifier });
      }, agent),
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

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description:
        'Edit a task\'s title, description, priority, or due date, as the user. Only when the user asks; first show them exactly what will change and wait for approval. Pass only the fields to change. description is markdown: mode "append" (default) adds to the end, "replace" rewrites it; for replace, start from the description get_task returned and keep what still applies. Keep image labels from get_task (e.g. [image 1 below: a.png]) where the image belongs; images your text drops are kept at the end. New screenshots: use the `markdown` from add_attachment after its PUT. Works on any task the user can edit.',
      inputSchema: {
        task: taskRefInput,
        title: z.string().trim().min(1).max(200).optional(),
        description: z
          .string()
          .trim()
          .max(10_000)
          .optional()
          .describe(
            "Markdown (paragraphs, lists, **bold**, `code`, links). Ticket ids like KAN-42 become linked tickets. Empty string with mode replace clears it.",
          ),
        mode: z.enum(["append", "replace"]).optional(),
        priority: priorityEnum.optional(),
        dueAt: z
          .string()
          .date()
          .nullable()
          .optional()
          .describe("YYYY-MM-DD, or null to clear."),
        agent: agentInput,
      },
      outputSchema: {
        identifier: z.string(),
        url: z.string().url(),
        updated: z.array(z.string()),
        keptImages: z.number().int(),
      },
      annotations: { ...writeHints, idempotentHint: false },
    },
    async ({
      task: ref,
      title,
      description,
      mode = "append",
      priority,
      dueAt,
      agent,
    }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        const patch: {
          title?: string;
          description?: string | null;
          priority?: typeof priority;
          dueAt?: Date | null;
        } = {};
        if (title !== undefined && title !== t.title) patch.title = title;
        if (priority !== undefined && priority !== t.priority) {
          patch.priority = priority;
        }
        if (dueAt !== undefined) patch.dueAt = dueAt ? new Date(dueAt) : null;

        let keptImages = 0;
        if (description !== undefined) {
          const before = t.description ?? "";
          if (mode === "append" && !description) {
            throw new McpUserError("Nothing to append; description is empty.");
          }
          const labels = await relinkImageLabels(description, t);
          let added = labels.markdown
            ? await docBodyFromMarkdown(
                labels.markdown,
                { id: t.projectId, key: t.projectKey },
                [t.projectId],
              )
            : "";
          added = labels.restore(await attachUploadRefs(added, caller, t));
          let html: string;
          if (mode === "append") {
            html = before + added;
          } else {
            const dropped = droppedFileTags(before, added);
            keptImages = dropped.length;
            html = added + dropped.map((tag) => `<p>${tag}</p>`).join("");
          }
          html = sanitizeRichText(html);
          if (html.length > MAX_DESCRIPTION_HTML) {
            throw new McpUserError(
              "Description would be too long. Shorten it, or use replace with a tighter version.",
            );
          }
          patch.description = html || null;
        }

        const updated = Object.keys(patch);
        if (updated.length === 0) {
          throw new McpUserError(
            "Nothing to change. Pass title, description, priority, or dueAt.",
          );
        }
        await caller.task
          .update({ boardId: t.boardId, taskId: t.id, ...patch })
          .catch(userFacing);
        return ok({
          identifier: t.identifier,
          url: taskUrl(t.projectSlug, t.number),
          updated,
          keptImages,
        });
      }, agent),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description:
        "Delete a task by moving it to the board's archive, where people can restore it. Only when the user explicitly asks to delete that task; confirm the identifier and title with them first. Never use it to close finished work; finish_task does that.",
      inputSchema: { task: taskRefInput, agent: agentInput },
      outputSchema: {
        status: z.literal("archived"),
        identifier: z.string(),
        title: z.string(),
      },
      annotations: { ...writeHints, destructiveHint: true },
    },
    async ({ task: ref, agent }) =>
      run(async (caller) => {
        const t = await resolveTask(caller, ref);
        await caller.task
          .archive({ boardId: t.boardId, taskId: t.id, archived: true })
          .catch(userFacing);
        // router logs nothing for archive -> keep who/which agent removed it
        await recordActivity(
          {
            db,
            session: { user: { id: auth.userId } },
            agent: await agentIdentity(auth.clientId, agent),
          },
          { boardId: t.boardId, taskId: t.id, verb: "task.archived" },
        );
        return ok({
          status: "archived",
          identifier: t.identifier,
          title: t.title,
        });
      }, agent),
  );
}
