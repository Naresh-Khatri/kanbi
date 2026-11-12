const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const FOOTER_RE = /<p><em>— via (.+?) \(agent\)<\/em><\/p>\s*$/;

/** Visible marker so people can tell agent-posted comments from their own. */
export function agentFooter(clientName: string): string {
  return `<p><em>— via ${escape(clientName)} (agent)</em></p>`;
}

/** Client name in the footer, or null for comments people wrote. */
export function agentClientOf(html: string): string | null {
  const match = FOOTER_RE.exec(html);
  return match
    ? match[1]!
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
    : null;
}

export function stripAgentFooter(html: string): string {
  return html.replace(FOOTER_RE, "");
}
