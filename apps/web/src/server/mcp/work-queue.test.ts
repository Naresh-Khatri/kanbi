import { describe, expect, it } from "vitest";

import {
  buildBrief,
  describeSince,
  compareQueue,
  inlineOrder,
  isWaitingOnPeople,
  labelInlineImages,
  matchProjects,
  parseIdentifier,
} from "./work-queue";

const projects = [
  { id: "1", key: "KAN", slug: "kanbi", name: "Kanbi" },
  { id: "2", key: "MAR", slug: "marketing-site", name: "Marketing Site" },
  { id: "3", key: "KB2", slug: "kanbi-mobile", name: "Kanbi Mobile" },
];

describe("matchProjects", () => {
  it("matches repo names, paths, and remotes exactly first", () => {
    for (const repo of [
      "kanbi",
      "/home/me/projects/kanbi",
      "git@github.com:me/kanbi.git",
      "KAN",
    ]) {
      expect(matchProjects(projects, repo).map((p) => p.id)).toEqual(["1"]);
    }
  });

  it("falls back to partial matches", () => {
    expect(matchProjects(projects, "marketing").map((p) => p.id)).toEqual([
      "2",
    ]);
    expect(
      matchProjects(projects, "kanbi-mobile-app").map((p) => p.id),
    ).toEqual(["1", "3"]);
  });

  it("returns nothing for unrelated or tiny hints", () => {
    expect(matchProjects(projects, "dotfiles")).toEqual([]);
    expect(matchProjects(projects, "ka")).toEqual([]);
  });
});

describe("compareQueue", () => {
  const at = (iso: string) => new Date(iso);
  it("orders by priority, due date, then age", () => {
    const tasks = [
      {
        id: "low",
        priority: "low" as const,
        dueAt: null,
        createdAt: at("2026-01-01"),
      },
      {
        id: "high-late",
        priority: "high" as const,
        dueAt: at("2026-12-01"),
        createdAt: at("2026-01-01"),
      },
      {
        id: "high-soon",
        priority: "high" as const,
        dueAt: at("2026-11-10"),
        createdAt: at("2026-01-02"),
      },
      {
        id: "high-undated",
        priority: "high" as const,
        dueAt: null,
        createdAt: at("2026-01-01"),
      },
      {
        id: "urgent",
        priority: "urgent" as const,
        dueAt: null,
        createdAt: at("2026-03-01"),
      },
    ];
    expect([...tasks].sort(compareQueue).map((t) => t.id)).toEqual([
      "urgent",
      "high-soon",
      "high-late",
      "high-undated",
      "low",
    ]);
  });
});

describe("parseIdentifier", () => {
  it("parses ticket identifiers case-insensitively", () => {
    expect(parseIdentifier("kan-42")).toEqual({ key: "KAN", number: 42 });
    expect(parseIdentifier("KB2-7")).toEqual({ key: "KB2", number: 7 });
    expect(parseIdentifier("abc123xyz")).toBeNull();
  });
});

describe("buildBrief", () => {
  const base = {
    identifier: "KAN-42",
    title: "Fix login",
    url: "https://kanbi.test/app/p/kanbi?task=t1",
    projectName: "Kanbi",
    columnName: "Todo",
    priority: "high" as const,
    dueAt: null,
    reporterName: "Asha",
    labels: [],
    checklist: [{ id: "c1", text: "Patch handler", done: false }],
    comments: [],
    images: ["screenshot.png"],
    files: [],
    guidance: null,
  };

  it("puts the original request before the AI-drafted description", () => {
    const brief = buildBrief({
      ...base,
      sourceText: "login broken on safari\nsee screenshot",
      description: "<p>The login form fails.</p>",
    });
    expect(brief.indexOf("## Original request")).toBeLessThan(
      brief.indexOf("## Description (AI-drafted"),
    );
    expect(brief).toContain("> login broken on safari\n> see screenshot");
    expect(brief).toContain("- [ ] Patch handler (id: c1)");
  });

  it("does not call a human-written description AI-drafted", () => {
    const brief = buildBrief({
      ...base,
      sourceText: null,
      description: "<p>Written by hand.</p>",
    });
    expect(brief).toContain("## Description\n\nWritten by hand.");
    expect(brief).not.toContain("AI-drafted");
  });

  it("points at get_task_comments when older comments are hidden", () => {
    const brief = buildBrief({
      ...base,
      sourceText: null,
      description: null,
      comments: [
        {
          author: "Asha",
          createdAt: new Date("2026-01-02"),
          body: "<p>hi</p>",
        },
      ],
      olderComments: 7,
    });
    expect(brief).toContain(
      "_7 older comments not shown; call get_task_comments with offset 1._",
    );
    expect(
      buildBrief({ ...base, sourceText: null, description: null }),
    ).not.toContain("get_task_comments");
  });
});

describe("isWaitingOnPeople", () => {
  const t = (iso: string) => new Date(iso);

  it("waits after a block until a person acts", () => {
    expect(isWaitingOnPeople({ blockedAt: null, humanAt: null })).toBe(false);
    expect(
      isWaitingOnPeople({ blockedAt: t("2026-01-02"), humanAt: null }),
    ).toBe(true);
    expect(
      isWaitingOnPeople({
        blockedAt: t("2026-01-02"),
        humanAt: t("2026-01-01"),
      }),
    ).toBe(true);
    expect(
      isWaitingOnPeople({
        blockedAt: t("2026-01-02"),
        humanAt: t("2026-01-03"),
      }),
    ).toBe(false);
  });
});

describe("inlineOrder", () => {
  const item = (
    id: string,
    day: number,
    extra: Partial<{
      commentId: string;
      viaAgent: string;
      isImage: boolean;
    }> = {},
  ) => ({
    id,
    commentId: extra.commentId ?? null,
    viaAgent: extra.viaAgent ?? null,
    isImage: extra.isImage ?? true,
    createdAt: new Date(2026, 0, day),
  });

  it("puts the first task image first, then people newest, then agents", () => {
    const order = inlineOrder([
      item("agent-old", 1, { viaAgent: "Claude" }),
      item("task-first", 2),
      item("pdf", 3, { isImage: false }),
      item("comment-new", 6, { commentId: "c2" }),
      item("task-later", 4),
      item("agent-new", 7, { viaAgent: "Claude" }),
    ]).map((i) => i.id);
    expect(order).toEqual([
      "task-first",
      "comment-new",
      "task-later",
      "agent-new",
      "agent-old",
      "pdf",
    ]);
  });
});

describe("labelInlineImages", () => {
  it("replaces inline images with escaped labels", () => {
    expect(
      labelInlineImages(
        '<p>See</p><img src="/api/files/a" alt="x"><img src="/api/files/zz">',
        new Map([["a", "image 1 below: <shot>.png"]]),
      ),
    ).toBe(
      "<p>See</p> [image 1 below: &lt;shot&gt;.png]  [image from another task, not attached] ",
    );
  });
});

describe("describeSince", () => {
  const at = (n: number) => new Date(Date.UTC(2026, 0, n));
  const row = (
    verb: string,
    actor: string,
    n: number,
    column = null as string | null,
  ) => ({
    verb,
    actor,
    column,
    createdAt: at(n),
  });

  it("keeps the latest move and groups the rest by person", () => {
    expect(
      describeSince([
        row("task.moved", "Asha", 1, "Review"),
        row("comment.created", "Asha", 2),
        row("comment.created", "Asha", 3),
        row("task.moved", "Asha", 4, "Todo"),
        row("attachment.added", "Ravi", 5),
      ]),
    ).toEqual([
      "Asha moved it to Todo",
      "Asha posted 2 comments (marked new below)",
      "Ravi attached 1 file",
    ]);
  });
});

describe("buildBrief since section", () => {
  it("lists changes and marks new comments", () => {
    const brief = buildBrief({
      identifier: "KAN-1",
      title: "t",
      url: "https://kanbi.test",
      projectName: "Kanbi",
      columnName: "Todo",
      priority: "none",
      dueAt: null,
      reporterName: null,
      labels: [],
      sourceText: null,
      description: null,
      checklist: [],
      comments: [
        {
          author: "Asha",
          createdAt: new Date("2026-01-03"),
          body: "<p>still broken</p>",
          isNew: true,
        },
      ],
      since: { at: new Date("2026-01-02"), changes: ["Asha moved it to Todo"] },
      images: [],
      files: [],
      guidance: null,
    });
    expect(brief).toContain(
      "## Since your last agent update (2026-01-02)\n\n- Asha moved it to Todo",
    );
    expect(brief).toContain("- **NEW** **Asha** (2026-01-03): still broken");
  });
});
