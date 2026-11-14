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
      '<p>Fixed <strong>login</strong> in <code>auth.ts</code>, see <a href="https://x.dev/1">PR</a>.</p>\n<p>Done.</p>',
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
      "<h2>Changes</h2>\n<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<pre><code>a &lt; b\n</code></pre>",
    );
    expect(markdownToHtml("1. a\n2. b")).toBe(
      "<ol>\n<li>a</li>\n<li>b</li>\n</ol>",
    );
  });

  it("escapes raw html instead of passing it through", () => {
    expect(markdownToHtml("<script>x</script>")).toBe(
      "<p>&lt;script&gt;x&lt;/script&gt;</p>",
    );
    expect(markdownToHtml("a <b>x</b> & `<i>`")).toBe(
      "<p>a &lt;b&gt;x&lt;/b&gt; &amp; <code>&lt;i&gt;</code></p>",
    );
  });

  it("leaves snake_case and paths alone", () => {
    expect(markdownToHtml("set_task_labels in src/foo_bar.ts")).toBe(
      "<p>set_task_labels in src/foo_bar.ts</p>",
    );
  });

  it("keeps single newlines as line breaks", () => {
    expect(markdownToHtml("one\ntwo")).toBe("<p>one<br>two</p>");
  });

  it("round-trips through htmlToMarkdown", () => {
    const md = "Fixed **login**.\n\n- one\n\n- two";
    expect(htmlToMarkdown(markdownToHtml(md))).toBe(md);
  });

  it("renders attachment and upload-ref images, not external ones", () => {
    expect(
      markdownToHtml(
        "Before: ![shot](/api/files/abc) then ![new](kanbi-upload:attachments/t/x.png)",
      ),
    ).toBe(
      '<p>Before: <img src="/api/files/abc" alt="shot"> then <img src="kanbi-upload:attachments/t/x.png" alt="new"></p>',
    );
    expect(markdownToHtml("![x](https://evil.dev/p.gif)")).not.toContain(
      "<img",
    );
  });
});
