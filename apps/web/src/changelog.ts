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
  /** 16:9 walkthrough */
  video?: { src: string; poster: string };
};

export const releases: Release[] = [
  {
    version: "0.4.0",
    date: "2026-11-27",
    entries: [
      "Group tasks into milestones for a release, launch or client review. Filter the board to one, move tasks with m, ⌘K or the bulk bar, and close it to carry unfinished work into the next. Closed milestones stay in project settings as history",
      "Coding agents can now move tasks between columns, update and archive tasks, start projects, adjust columns, write project docs and manage milestones",
      "Paste screenshots straight into the new task dialog and mark them up before saving",
      "If your session expires while the app is open, you can sign back in without losing what you were writing",
    ],
    video: {
      src: "https://kanbi-cdn.nareshkhatri.dev/videos/release-0-4.mp4",
      poster: "https://kanbi-cdn.nareshkhatri.dev/videos/release-0-4.jpg",
    },
  },
  {
    version: "0.3.0",
    date: "2026-11-16",
    entries: [
      "Open tasks in the side sheet or as a full page, with your choice remembered. Task links are now short ticket numbers, and tasks open noticeably faster",
      "Coding agents can claim unassigned tasks, attach short videos as well as screenshots, and send finished work to a new Review column for you to check. Their comments carry an agent badge, which project owners can hide",
      "A slash command menu in the editor, hover previews for links, tasks and people, inline video playback, and a fullscreen zoomable image viewer",
      "Shareable invite links with a limit on how many people can join",
      "Cards show what changed since you last looked and how long ago",
    ],
    video: {
      src: "https://kanbi-cdn.nareshkhatri.dev/videos/release-0-3.mp4",
      poster: "https://kanbi-cdn.nareshkhatri.dev/videos/release-0-3.jpg",
    },
  },
  {
    version: "0.2.0",
    date: "2026-11-12",
    entries: [
      "Connect coding agents over MCP to work through your assigned tasks: they pick up the queue for the current repo, post progress, blockers, checklist updates and screenshots, and can read project docs",
      "Public board links now open a full read-only board with progress, task details and image attachments",
      "A refreshed interface with a slim top bar, and project settings split into General, Access and Notifications tabs",
      "Invite links now confirm you're signed in with the invited account before you join",
    ],
  },
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
