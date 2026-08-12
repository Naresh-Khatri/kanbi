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
      "Build project knowledge pages with search, version history, task links, and grounded AI answers from your workspace",
      "Shape each board around explicit backlog, in-progress, and completed workflow categories",
      "Select multiple tasks to update or archive them together",
      "Customize columns with sorting and visibility preferences, navigate projects faster, and enjoy smoother drag-and-drop",
      "Task detail with rich text, checklists, attachments, comments, labels, and per-project ticket numbers you can reference with #",
      "Collaborate with live board updates, presence, notifications, teammate roles, share links, and weekly digests",
      "Draft tasks with AI, use keyboard-first controls, and pair the Focus companion app for distraction-free sessions",
    ],
  },
];

export const APP_VERSION = releases[0]?.version ?? "0.0.0";
