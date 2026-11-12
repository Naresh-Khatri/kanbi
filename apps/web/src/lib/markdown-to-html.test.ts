import { describe, expect, it } from "vitest";

import { htmlToMarkdown } from "./html-to-markdown";
import { markdownToHtml } from "./markdown-to-html";

describe("markdownToHtml", () => {
  it("converts paragraphs, marks, and links", () => {
    expect(
      markdownToHtml(
        "Fixed **login** in `auth.ts`, see [PR](https://x.dev/1).\n\nDone.",
      ),
    ).toBe(
      '<p>Fixed <strong>login</strong> in <code>auth.ts</code>, see <a href="https://x.dev/1">PR</a>.</p><p>Done.</p>',
    );
  });

  it("links bare urls", () => {
    expect(markdownToHtml("PR: https://github.com/a/b/pull/3")).toBe(
      '<p>PR: <a href="https://github.com/a/b/pull/3">https://github.com/a/b/pull/3</a></p>',
    );
  });

  it("builds lists, headings, and fences", () => {
    expect(
      markdownToHtml("## Changes\n- one\n- [x] two\n\n```\na < b\n```"),
    ).toBe(
      "<h2>Changes</h2><ul><li><p>one</p></li><li><p>two</p></li></ul><pre><code>a &lt; b</code></pre>",
    );
    expect(markdownToHtml("1. a\n2. b")).toBe(
      "<ol><li><p>a</p></li><li><p>b</p></li></ol>",
    );
  });

  it("escapes raw html instead of passing it through", () => {
    expect(markdownToHtml("<script>x</script> & `<b>`")).toBe(
      "<p>&lt;script&gt;x&lt;/script&gt; &amp; <code>&lt;b&gt;</code></p>",
    );
  });

  it("leaves snake_case and paths alone", () => {
    expect(markdownToHtml("set_task_labels in src/foo_bar.ts")).toBe(
      "<p>set_task_labels in src/foo_bar.ts</p>",
    );
  });

  it("round-trips through htmlToMarkdown", () => {
    const md = "Fixed **login**.\n\n- one\n\n- two";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });
});
