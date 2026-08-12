import { describe, expect, it } from "vitest";

import {
  documentExcerpt,
  documentRelevance,
  documentSearchTerms,
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

  it("builds a compact lexical query for project questions", () => {
    expect(
      documentSearchTerms("Where is the CI deploy runbook for S3?"),
    ).toEqual(["ci", "deploy", "runbook", "s3"]);
    expect(documentSearchTerms("Why is it?")).toEqual([]);
  });

  it("ranks title matches ahead of incidental body matches", () => {
    const terms = ["deploy", "runbook"];
    const titleMatch = documentRelevance({
      title: "Deploy runbook",
      text: "Production steps",
      question: "deploy runbook",
      terms,
      current: false,
    });
    const bodyMatch = documentRelevance({
      title: "Engineering notes",
      text: "The deploy runbook was discussed once.",
      question: "deploy runbook",
      terms,
      current: false,
    });
    expect(titleMatch).toBeGreaterThan(bodyMatch);
  });

  it("extracts model context around the matching passage", () => {
    const excerpt = documentExcerpt(
      `${"Opening context ".repeat(30)}production deploy checklist${" trailing notes".repeat(30)}`,
      ["production", "deploy"],
      180,
    );
    expect(excerpt).toContain("production deploy checklist");
    expect(excerpt.length).toBeLessThanOrEqual(182);
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
