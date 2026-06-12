import "server-only";

import sanitizeHtml from "sanitize-html";

/**
 * Server-side HTML allowlist for agent-authored rich text.
 *
 * On the web, descriptions and comments are produced by the Tiptap editor, so
 * their markup is already constrained to the ProseMirror schema before it's
 * sent. The MCP write tools let an agent POST raw HTML straight through tRPC,
 * bypassing that editor - so we re-impose the same shape here, at the persist
 * boundary, instead of trusting that the single read-only renderer happens to
 * drop unknown nodes. Anything outside this set (script/style/img/iframe, event
 * handlers, javascript: URLs) is removed.
 *
 * The tag/attribute set mirrors the editor: StarterKit + Underline + Link, plus
 * the mention/ticket spans Tiptap round-trips as `data-*`-attributed spans.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "del",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "a",
    "span",
    "hr",
  ],
  allowedAttributes: {
    // `rel` is allowlisted so the transformTags rel below survives attribute
    // filtering (transform runs first, then the allowlist prunes anything else).
    a: ["href", "title", "rel"],
    // Tiptap mention/ticket nodes serialize as <span data-type data-id ...>.
    span: ["data-type", "data-id", "data-label"],
  },
  // Only these URL schemes survive on <a href>; javascript:/data: are dropped.
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  // Force a safe rel on every surviving link; target is not allowlisted, so it
  // can't open an attacker-controlled context.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer nofollow",
    }),
  },
};

/**
 * Sanitize a rich-text HTML string to the editor's allowlist. Returns "" for
 * nullish input. Idempotent on already-clean editor output.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
