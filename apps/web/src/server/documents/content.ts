import sanitizeHtml from "sanitize-html";

const TICKET_ID = /^[A-Za-z0-9_-]{6,64}$/;

const QUESTION_STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "how",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "should",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
  "would",
]);

/** Derive a compact search string without persisting HTML markup. */
export function richTextToPlainText(html: string): string {
  const withBlockSpacing = html.replace(
    /<\/?(?:p|h[1-6]|li|blockquote|pre|div|br)\b[^>]*>/gi,
    " ",
  );
  return sanitizeHtml(withBlockSpacing, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract stable task ids from canonical Tiptap ticket mention spans. */
export function extractTicketIds(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(/<span\b([^>]*)>/gi)) {
    const attributes = match[1] ?? "";
    if (!/data-type\s*=\s*["']ticket["']/i.test(attributes)) continue;
    const id = attributes.match(/data-id\s*=\s*["']([^"']+)["']/i)?.[1];
    if (id && TICKET_ID.test(id)) ids.add(id);
  }
  return [...ids];
}

/** Small lexical query used by Ask Docs before introducing an embedding index. */
export function documentSearchTerms(question: string): string[] {
  const tokens = question.toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
  const useful = tokens.filter(
    (token) => token.length >= 2 && !QUESTION_STOP_WORDS.has(token),
  );
  return [...new Set(useful)].slice(0, 8);
}

function occurrences(text: string, term: string) {
  let count = 0;
  let cursor = 0;
  while (count < 4) {
    const index = text.indexOf(term, cursor);
    if (index === -1) break;
    count += 1;
    cursor = index + term.length;
  }
  return count;
}

/** Rank a small candidate set without another database or search dependency. */
export function documentRelevance(input: {
  title: string;
  text: string;
  question: string;
  terms: string[];
  current: boolean;
}): number {
  const title = input.title.toLowerCase();
  const text = input.text.toLowerCase();
  const question = input.question.trim().toLowerCase();
  let score = input.current ? 2 : 0;

  if (question.length >= 3 && title.includes(question)) score += 20;
  if (question.length >= 3 && text.includes(question)) score += 8;
  for (const term of input.terms) {
    score += occurrences(title, term) * 5;
    score += occurrences(text, term);
  }
  return score;
}

/** Keep the passage around the first matching term so the model sees evidence. */
export function documentExcerpt(
  text: string,
  terms: string[],
  maxLength = 3_500,
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;

  const lower = normalized.toLowerCase();
  const matches = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0);
  const firstMatch = matches.length > 0 ? Math.min(...matches) : 0;
  let start = Math.max(0, firstMatch - Math.floor(maxLength / 4));
  if (start > 0) {
    const nextSpace = normalized.indexOf(" ", start);
    if (nextSpace > 0 && nextSpace - start < 80) start = nextSpace + 1;
  }
  const end = Math.min(normalized.length, start + maxLength);
  return `${start > 0 ? "…" : ""}${normalized.slice(start, end).trim()}${end < normalized.length ? "…" : ""}`;
}

export type DocumentParent = { id: string; parentId: string | null };

/** True when assigning `parentId` would make a document its own ancestor. */
export function wouldCreateDocumentCycle(
  documents: readonly DocumentParent[],
  documentId: string,
  parentId: string | null,
): boolean {
  if (!parentId) return false;
  const parentById = new Map(documents.map((doc) => [doc.id, doc.parentId]));
  const visited = new Set<string>();
  let cursor: string | null = parentId;
  while (cursor) {
    if (cursor === documentId) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
  return false;
}
