import { describe, expect, it } from "vitest";

import {
  buildBrief,
  compareQueue,
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
    expect(matchProjects(projects, "kanbi-mobile-app").map((p) => p.id)).toEqual(
      ["1", "3"],
    );
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
      { id: "low", priority: "low" as const, dueAt: null, createdAt: at("2026-01-01") },
      { id: "high-late", priority: "high" as const, dueAt: at("2026-12-01"), createdAt: at("2026-01-01") },
      { id: "high-soon", priority: "high" as const, dueAt: at("2026-11-10"), createdAt: at("2026-01-02") },
      { id: "high-undated", priority: "high" as const, dueAt: null, createdAt: at("2026-01-01") },
      { id: "urgent", priority: "urgent" as const, dueAt: null, createdAt: at("2026-03-01") },
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
});
