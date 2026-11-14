import { isInlineImageSrc } from "./file-url";

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const IMAGE_RE = /^!\[([^\]\n]*)\]\(([^\s)]+)\)$/;

function inline(text: string): string {
  // code spans and images split out first so marks never touch their contents
  return text
    .split(/(`[^`\n]+`|!\[[^\]\n]*\]\([^\s)]+\))/g)
    .map((part) => {
      if (/^`[^`\n]+`$/.test(part))
        return `<code>${escape(part.slice(1, -1))}</code>`;
      const image = IMAGE_RE.exec(part);
      // only kanbi files; anything else stays literal (sanitizer drops foreign imgs anyway)
      if (image && isInlineImageSrc(image[2]!)) {
        return `<img src="${image[2]}" alt="${escape(image[1]!).replace(/"/g, "&quot;")}">`;
      }
      return escape(part)
        .replace(
          /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
          (_, label: string, href: string) =>
            `<a href="${href.replace(/"/g, "&quot;")}">${label}</a>`,
        )
        .replace(
          /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
          (_, lead: string, href: string) =>
            `${lead}<a href="${href.replace(/"/g, "&quot;")}">${href}</a>`,
        )
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, "$1<em>$2</em>");
    })
    .join("");
}

/**
 * Small markdown subset (paragraphs, headings, lists, fences, inline marks,
 * links, kanbi images) -> editor-compatible HTML. Output still goes through sanitizeRichText.
 */
export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!))
        code.push(lines[i++]!);
      i++;
      out.push(`<pre><code>${escape(code.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]!.length;
      out.push(`<h${level}>${inline(heading[2]!.trim())}</h${level}>`);
      i++;
      continue;
    }

    const list = /^\s*([-*+]|\d+[.)])\s+/.exec(line);
    if (list) {
      const ordered = /\d/.test(list[1]!);
      const items: string[] = [];
      while (i < lines.length) {
        const m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]!);
        if (!m || /\d/.test(m[1]!) !== ordered) break;
        items.push(
          `<li><p>${inline(m[2]!.replace(/^\[[ xX]\]\s*/, ""))}</p></li>`,
        );
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i]!)) {
        quote.push(lines[i++]!.replace(/^>\s?/, ""));
      }
      out.push(
        `<blockquote><p>${quote.map(inline).join("<br>")}</p></blockquote>`,
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !/^\s*(```|#{1,4}\s|[-*+]\s|\d+[.)]\s|>)/.test(lines[i]!)
    ) {
      para.push(lines[i++]!);
    }
    out.push(`<p>${para.map(inline).join("<br>")}</p>`);
  }

  return out.join("");
}
