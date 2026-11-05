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

/**
 * Lossy conversion of Kanbi's sanitized rich-text HTML to markdown for agents
 * and plain-text snapshots. Only expects the editor's small tag set.
 */
export function htmlToMarkdown(html: string): string {
  const md = html
    .replace(/\r\n?/g, "\n")
    .replace(/<pre[^>]*>\s*(?:<code[^>]*>)?/gi, "\n\n```\n")
    .replace(/\s*(?:<\/code>)?\s*<\/pre>/gi, "\n```\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<h([1-6])[^>]*>/gi, (_, level: string) => {
      return `\n\n${"#".repeat(Number(level))} `;
    })
    .replace(/<li[^>]*>\s*(?:<p[^>]*>)?/gi, "\n- ")
    .replace(/<blockquote[^>]*>\s*(?:<p[^>]*>)?/gi, "\n\n> ")
    .replace(/<\/(p|h[1-6]|ul|ol|blockquote|div)>/gi, "\n\n")
    .replace(/<\/?(strong|b)(\s[^>]*)?>/gi, "**")
    .replace(/<\/?(em|i)(\s[^>]*)?>/gi, "_")
    .replace(/<\/?code(\s[^>]*)?>/gi, "`")
    .replace(
      /<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, text: string) =>
        text.trim() && text.trim() !== href ? `[${text}](${href})` : href,
    )
    .replace(/<[^>]+>/g, "");

  return decodeEntities(md)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n- \n+/g, "\n- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
