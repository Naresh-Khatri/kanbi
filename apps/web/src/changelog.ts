/**
 * Release notes, newest first — the single source of truth for "what version is
 * this". Maintained by the `/release` skill, which prepends an entry, bumps the
 * package.json versions, and tags the commit.
 */

export type Release = {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  entries: string[];
};

export const releases: Release[] = [
  {
    version: "0.1.0",
    date: "2026-08-12",
    entries: [
      "Boards with drag-and-drop tasks and columns, per-column sorting, and an archive you can restore from",
      "Task detail with rich text, checklists, attachments, comments, labels, and per-project ticket numbers you can reference with #",
      "Live sync for everyone on a board, with presence and in-app notifications",
      "Draft tasks from a rough note with AI, and get a weekly digest of what moved",
      "A command palette and single-key shortcuts for everything — press ? for the full list",
      "Read-only share links, teammate invites with roles, and pairing for the Focus companion app",
    ],
  },
];

export const APP_VERSION = releases[0]?.version ?? "0.0.0";
