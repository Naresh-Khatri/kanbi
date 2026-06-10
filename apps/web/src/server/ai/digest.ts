import "server-only";

import { z } from "zod";

import { GROQ_DRAFT_MODEL, getGroq } from "@/server/ai/groq";
import type { DigestContent, DigestStats } from "@/server/db/schema";

export type DigestEvent = {
  at: Date;
  actor: string;
  verb: string;
  taskTitle: string | null;
  detail?: string | null;
};

/** Cap the event log fed to the model so a busy week stays within budget. */
const MAX_EVENTS = 200;

const responseSchema = z.object({
  headline: z.string().min(1).max(140),
  summary: z.string().min(1).max(1500),
  highlights: z.array(z.string().min(1).max(240)).max(8),
});

export type DigestDraft = z.infer<typeof responseSchema>;

function formatEvent(e: DigestEvent) {
  const day = e.at.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const verb = e.verb.replace(/^task\.|^comment\./, "");
  const task = e.taskTitle ? ` "${e.taskTitle}"` : "";
  const detail = e.detail ? ` (${e.detail})` : "";
  return `- [${day}] ${e.actor} ${verb}${task}${detail}`;
}

/**
 * Turn a week of activity-log events into a short, human standup-style digest.
 * Deterministic counts come from `stats`; the model writes the prose around them.
 */
export async function generateDigest(input: {
  boardName: string;
  periodLabel: string;
  stats: DigestStats;
  events: DigestEvent[];
}): Promise<DigestDraft> {
  const events = input.events.slice(0, MAX_EVENTS);

  const system = [
    "You are a project chronicler. Write a concise weekly digest of what happened on a kanban board, in the spirit of an async standup — the kind a teammate skims in 20 seconds.",
    `Board: ${input.boardName}`,
    `Period: ${input.periodLabel}`,
    `Counts for the period — created: ${input.stats.created}, updated: ${input.stats.updated}, moved: ${input.stats.moved}, completed: ${input.stats.completed}, comments: ${input.stats.comments}, contributors: ${input.stats.contributors}.`,
    "Output JSON matching this shape exactly:",
    `{"headline":string,"summary":string,"highlights":string[]}`,
    "Rules:",
    "- headline: one punchy line capturing the week's theme, under 100 chars. No trailing period.",
    "- summary: 2-4 plain-text sentences. Mention momentum (what moved forward, what shipped, where attention went). Reference the real numbers above. No markdown, no HTML.",
    "- highlights: 3-6 short plain-text bullets of the most notable specific items (a task that shipped, a hot discussion, a stalled area). Each references a real task or person from the log. Omit the bullet list entirely (empty array) only if there is genuinely nothing notable.",
    "- Ground everything in the event log; never invent tasks, people, or outcomes not present below.",
    "- Be factual and calm. No hype, no emoji, no commentary about being an AI.",
    "- Return only the JSON object.",
  ].join("\n\n");

  const userContent =
    events.length > 0
      ? `Activity log (most recent first):\n${events.map(formatEvent).join("\n")}`
      : "No activity was recorded this period.";

  const groq = getGroq();
  const completion = await groq.chat.completions.create({
    model: GROQ_DRAFT_MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = responseSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error("AI digest response did not match expected shape");
  }
  return parsed.data;
}

/** Merge the model draft with deterministic stats into a stored digest body. */
export function toDigestContent(
  draft: DigestDraft,
  stats: DigestStats,
): DigestContent {
  return { ...draft, stats };
}
