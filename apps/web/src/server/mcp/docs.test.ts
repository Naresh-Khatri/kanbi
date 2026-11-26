import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/mcp/caller", () => ({ createMcpCaller: vi.fn() }));
vi.mock("@/server/db", () => ({ db: {} }));

import {
  attachmentKeyFromUrl,
  flattenTree,
  linkTickets,
  restoreFileRefs,
} from "./docs";

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

describe("attachmentKeyFromUrl", () => {
  it("reads the key from presigned and public urls", () => {
    expect(
      attachmentKeyFromUrl(
        "https://acc.r2.cloudflarestorage.com/bucket/attachments/t1/abc-shot%20one.png?X-Amz-Signature=x&y=1",
      ),
    ).toBe("attachments/t1/abc-shot one.png");
    expect(
      attachmentKeyFromUrl("https://cdn.example.com/attachments/t1/a.png"),
    ).toBe("attachments/t1/a.png");
    expect(attachmentKeyFromUrl("https://example.com/a.png")).toBeNull();
    expect(attachmentKeyFromUrl("not a url")).toBeNull();
  });
});

describe("restoreFileRefs", () => {
  const files = new Map([
    ["attachments/t1/a.png", { id: "img1", filename: "a.png" }],
    ["attachments/t1/b.mp4", { id: "vid1", filename: "b.mp4" }],
  ]);

  it("maps known presigned urls back to /api/files", () => {
    const md =
      "![shot](https://r2.test/bkt/attachments/t1/a.png?sig=1&x=2)\n[video](https://r2.test/bkt/attachments/t1/b.mp4?sig=1)";
    expect(restoreFileRefs(md, files)).toBe(
      "![shot](/api/files/img1)\n![b.mp4](/api/files/vid1)",
    );
  });

  it("leaves unknown urls and plain links alone", () => {
    const md =
      "![x](https://elsewhere.test/pic.png) [video](https://youtube.test/v)";
    expect(restoreFileRefs(md, files)).toBe(md);
  });
});

describe("linkTickets", () => {
  const ids = new Map([[42, "task-42-id"]]);

  it("turns known ticket ids into mention spans", () => {
    expect(linkTickets("<p>See KAN-42 and KAN-7.</p>", "KAN", ids)).toBe(
      '<p>See <span data-type="ticket" data-id="task-42-id" data-label="KAN-42">KAN-42</span> and KAN-7.</p>',
    );
  });

  it("skips code, links, and lookalike keys", () => {
    const html =
      '<p><code>KAN-42</code> <a href="/x">KAN-42</a> XKAN-42 KAN-420</p><pre><code>KAN-42</code></pre>';
    expect(linkTickets(html, "KAN", ids)).toBe(html);
  });
});
