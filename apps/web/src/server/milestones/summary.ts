import "server-only";

import { generateObject } from "ai";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { positionAtEnd } from "@/lib/position";
import { draftModel } from "@/server/ai/model";
import type { db as Database } from "@/server/db";
import {
  documentRevision,
  documentTaskLink,
  projectDocument,
} from "@/server/db/schema";
import { richTextToPlainText } from "@/server/documents/content";
import { sanitizeRichText } from "@/server/rich-text/sanitize-core";

type SummaryTask = { id: string; number: number; title: string };

const escape = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const ticket = (key: string, t: SummaryTask) =>
  `<span data-type="ticket" data-id="${escape(t.id)}" data-label="${escape(`${key}-${t.number}`)}">${escape(`${key}-${t.number}`)}</span>`;

const list = (key: string, tasks: readonly SummaryTask[]) =>
  `<ul>${tasks.map((t) => `<li><p>${ticket(key, t)} ${escape(t.title)}</p></li>`).join("")}</ul>`;

async function aiIntro(input: {
  milestone: string;
  description: string | null;
  finished: readonly SummaryTask[];
  unfinished: readonly SummaryTask[];
}): Promise<string | null> {
  try {
    const { object } = await generateObject({
      model: draftModel(),
      schema: z.object({ summary: z.string().min(1).max(1200) }),
      temperature: 0.3,
      system: [
        "Write a short plain-language recap of a finished milestone on a kanban board, readable by non-technical clients.",
        "2-4 sentences. Say what was delivered, grouped by theme where possible, and mention what was carried over if anything. No markdown, no HTML, no emoji, no hype. Never invent work that isn't listed.",
        'Return JSON: {"summary": string}.',
      ].join("\n"),
      prompt: [
        `Milestone: ${input.milestone}`,
        input.description ? `Goal: ${input.description}` : null,
        `Finished:\n${input.finished.map((t) => `- ${t.title}`).join("\n") || "- (none)"}`,
        `Carried over:\n${input.unfinished.map((t) => `- ${t.title}`).join("\n") || "- (none)"}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
    return object.summary;
  } catch {
    // ai optional -> doc still gets the task lists
    return null;
  }
}

/** Write a Doc recapping a closed milestone; returns its id. */
export async function writeMilestoneSummary(
  db: typeof Database,
  args: {
    projectId: string;
    projectKey: string;
    userId: string;
    milestone: string;
    description: string | null;
    finished: readonly SummaryTask[];
    unfinished: readonly SummaryTask[];
    carriedTo: string | null;
  },
): Promise<string> {
  const intro = await aiIntro(args);
  const parts = [
    intro ? `<p>${escape(intro)}</p>` : null,
    `<h2>Finished (${args.finished.length})</h2>`,
    args.finished.length
      ? list(args.projectKey, args.finished)
      : "<p>Nothing.</p>",
    args.unfinished.length
      ? `<h2>Carried over to ${escape(args.carriedTo ?? "no milestone")} (${args.unfinished.length})</h2>${list(args.projectKey, args.unfinished)}`
      : null,
  ];
  const body = sanitizeRichText(parts.filter(Boolean).join("")) || "<p></p>";
  const title = `${args.milestone} summary`.slice(0, 200);
  const taskIds = [...args.finished, ...args.unfinished].map((t) => t.id);

  const siblings = await db
    .select({ position: projectDocument.position })
    .from(projectDocument)
    .where(
      and(
        eq(projectDocument.projectId, args.projectId),
        isNull(projectDocument.parentId),
      ),
    )
    .orderBy(asc(projectDocument.position));

  return db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(projectDocument)
      .values({
        projectId: args.projectId,
        parentId: null,
        title,
        body,
        searchText: richTextToPlainText(body),
        position: positionAtEnd(siblings),
        createdById: args.userId,
        updatedById: args.userId,
      })
      .returning({ id: projectDocument.id, version: projectDocument.version });
    if (!doc) throw new Error("summary doc insert failed");
    await tx.insert(documentRevision).values({
      documentId: doc.id,
      version: doc.version,
      title,
      body,
      editorId: args.userId,
    });
    if (taskIds.length > 0) {
      await tx
        .insert(documentTaskLink)
        .values(taskIds.map((taskId) => ({ documentId: doc.id, taskId })))
        .onConflictDoNothing();
    }
    return doc.id;
  });
}
