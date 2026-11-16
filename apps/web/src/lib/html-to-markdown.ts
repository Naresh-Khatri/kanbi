const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const n =
        code[1]?.toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function convertLists(html: string): string {
  const stack: { ordered: boolean; n: number }[] = [];
  return html.replace(
    /<(\/?)(ul|ol|li)\b([^>]*)>/gi,
    (_, close: string, tag: string, attrs: string) => {
      const name = tag.toLowerCase();
      if (name === "li") {
        if (close) return "";
        const list = stack.at(-1);
        const indent = "   ".repeat(Math.max(0, stack.length - 1));
        return `\n${indent}${list?.ordered ? `${++list.n}.` : "-"} `;
      }
      if (close) {
        stack.pop();
        return stack.length > 0 ? "" : "\n\n";
      }
      const start = Number(/\sstart="(\d+)"/i.exec(attrs)?.[1] ?? 1);
      stack.push({ ordered: name === "ol", n: start - 1 });
      return "";
    },
  );
}

/**
 * Lossy conversion of Kanbi's sanitized rich-text HTML to markdown for agents
 * and plain-text snapshots. Only expects the editor's small tag set.
 */
export function htmlToMarkdown(html: string): string {
  const md = convertLists(html.replace(/\r\n?/g, "\n"))
    .replace(/<pre[^>]*>\s*(?:<code[^>]*>)?/gi, "\n\n```\n")
    .replace(/\s*(?:<\/code>)?\s*<\/pre>/gi, "\n```\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h([1-6])[^>]*>/gi, (_, level: string) => {
      return `\n\n${"#".repeat(Number(level))} `;
    })
    .replace(/<blockquote[^>]*>\s*(?:<p[^>]*>)?/gi, "\n\n> ")
    .replace(/<\/(p|h[1-6]|blockquote|div)>/gi, "\n\n")
    .replace(/<\/?(strong|b)(\s[^>]*)?>/gi, "**")
    .replace(/<\/?(em|i)(\s[^>]*)?>/gi, "_")
    .replace(/<\/?code(\s[^>]*)?>/gi, "`")
    .replace(
      /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, text: string) =>
        text.trim() && text.trim() !== href ? `[${text}](${href})` : href,
    )
    .replace(/<img\s[^>]*>/gi, (tag) => {
      const src = /\ssrc="([^"]*)"/i.exec(tag)?.[1] ?? "";
      const alt = /\salt="([^"]*)"/i.exec(tag)?.[1] ?? "image";
      return src ? `![${alt}](${src})` : "";
    })
    .replace(/<video\s[^>]*>/gi, (tag) => {
      const src = /\ssrc="([^"]*)"/i.exec(tag)?.[1];
      return src ? `[video](${src})` : "";
    })
    .replace(/<[^>]+>/g, "");

  return decodeEntities(md)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n( *(?:-|\d+\.)) \n+/g, "\n$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
