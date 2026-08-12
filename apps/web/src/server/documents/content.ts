import sanitizeHtml from "sanitize-html";

const TICKET_ID = /^[A-Za-z0-9_-]{6,64}$/;

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
