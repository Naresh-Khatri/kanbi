import { customAlphabet, nanoid } from "nanoid";

export { nanoid };

/** URL-safe, lowercase + digits — used for share tokens. */
export const shareToken = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  24,
);

/** Short human-friendly slug fragment when auto-generating project slugs. */
export const slugSuffix = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  6,
);

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Shape a user-typed project key into the canonical `^[A-Z][A-Z0-9]{1,9}$` form. */
export function normalizeProjectKey(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^[0-9]+/, "")
    .slice(0, 10);
}

/**
 * Jira-style short key derived from a project name: initials of the first few
 * words (e.g. "Marketing Site" → "MS"), else the leading letters of a single
 * word (e.g. "Marketing" → "MAR"). Always 2–6 chars, starts with a letter.
 * Callers must still ensure it's unique per owner (append a suffix on collision).
 */
export function deriveProjectKey(name: string): string {
  const cleaned = name.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  let key = "";
  if (words.length > 1) {
    key = words
      .map((w) => w[0])
      .join("")
      .slice(0, 4);
  }
  if (key.length < 2) key = cleaned.replace(/\s+/g, "").slice(0, 3);
  key = key.replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]/.test(key)) key = `P${key}`;
  if (key.length < 2) key = "PRJ";
  return key.slice(0, 6);
}
