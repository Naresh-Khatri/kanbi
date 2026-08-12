import { describe, expect, it } from "vitest";

import {
  extractTicketIds,
  richTextToPlainText,
  wouldCreateDocumentCycle,
} from "@/server/documents/content";
import { sanitizeRichText } from "@/server/rich-text/sanitize-core";

describe("document content", () => {
  it("derives normalized searchable text", () => {
    expect(
      richTextToPlainText("<h2>Runbook</h2><p>Deploy&nbsp; safely</p>"),
    ).toBe("Runbook Deploy safely");
  });

  it("extracts unique canonical ticket ids", () => {
    const html = [
      '<span data-type="ticket" data-id="task_abc123">KAN-1</span>',
      '<span data-id="task_abc123" data-type="ticket">KAN-1</span>',
      '<span data-type="mention" data-id="user_abc123">@Sam</span>',
      '<span data-type="ticket" data-id="bad id">bad</span>',
    ].join("");
    expect(extractTicketIds(html)).toEqual(["task_abc123"]);
  });

  it("sanitizes unsafe markup while preserving canonical mentions", () => {
    const clean = sanitizeRichText(
      '<p onclick="bad()">Safe <script>alert(1)</script><a href="javascript:bad()">link</a> <span data-type="ticket" data-id="task_abc123">KAN-1</span></p>',
    );
    expect(clean).toContain("Safe");
    expect(clean).toContain('data-type="ticket"');
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
  });

  it("detects self and descendant cycles", () => {
    const docs = [
      { id: "a", parentId: null },
      { id: "b", parentId: "a" },
      { id: "c", parentId: "b" },
    ];
    expect(wouldCreateDocumentCycle(docs, "a", "c")).toBe(true);
    expect(wouldCreateDocumentCycle(docs, "b", "b")).toBe(true);
    expect(wouldCreateDocumentCycle(docs, "c", "a")).toBe(false);
    expect(wouldCreateDocumentCycle(docs, "c", null)).toBe(false);
  });
});
