import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/mcp/caller", () => ({ createMcpCaller: vi.fn() }));
vi.mock("@/server/db", () => ({ db: {} }));

import { flattenTree } from "./docs";

describe("flattenTree", () => {
  it("orders depth-first by position and keeps orphans", () => {
    const rows = [
      { id: "b", parentId: null, position: 2 },
      { id: "a", parentId: null, position: 1 },
      { id: "a2", parentId: "a", position: 2 },
      { id: "a1", parentId: "a", position: 1 },
      { id: "o", parentId: "gone", position: 0 },
    ];
    expect(flattenTree(rows).map((r) => `${r.id}:${r.depth}`)).toEqual([
      "o:0",
      "a:0",
      "a1:1",
      "a2:1",
      "b:0",
    ]);
  });
});
