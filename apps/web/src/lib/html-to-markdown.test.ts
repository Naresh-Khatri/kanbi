import { describe, expect, it } from "vitest";

import { htmlToMarkdown } from "./html-to-markdown";

describe("htmlToMarkdown", () => {
  it("converts paragraphs, marks, and links", () => {
    expect(
      htmlToMarkdown(
        '<p>Fix <strong>login</strong> on <em>Safari</em>, see <a href="https://x.dev/a">this</a>.</p><p>Second &amp; last.</p>',
      ),
    ).toBe(
      "Fix **login** on _Safari_, see [this](https://x.dev/a).\n\nSecond & last.",
    );
  });

  it("flattens lists, including tiptap's <li><p> shape", () => {
    expect(
      htmlToMarkdown("<ul><li><p>one</p></li><li><p>two</p></li></ul><p>after</p>"),
    ).toBe("- one\n\n- two\n\nafter");
    expect(htmlToMarkdown("<ol><li>a</li><li>b</li></ol>")).toBe("- a\n- b");
  });

  it("keeps code and escaped angle brackets", () => {
    expect(
      htmlToMarkdown("<p>The <code>&lt;Button&gt;</code> breaks</p>"),
    ).toBe("The `<Button>` breaks");
    expect(htmlToMarkdown("<pre><code>a &lt; b\n</code></pre>")).toBe(
      "```\na < b\n```",
    );
  });

  it("collapses bare links to the url", () => {
    expect(
      htmlToMarkdown('<a href="https://x.dev">https://x.dev</a>'),
    ).toBe("https://x.dev");
  });
});
