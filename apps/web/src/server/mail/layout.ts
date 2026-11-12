import "server-only";

// coss neutral tokens (globals.css) resolved to hex; mail clients can't do oklch/color-mix
const light = {
  page: "#fafafa",
  card: "#ffffff",
  fg: "#262626",
  muted: "#686868",
  border: "#ebebeb",
  subtle: "#f5f5f5",
  primary: "#262626",
  primaryFg: "#fafafa",
};

const dark = {
  page: "#161616",
  card: "#1b1b1b",
  fg: "#f5f5f5",
  muted: "#818181",
  border: "#262626",
  subtle: "#202020",
  primary: "#f5f5f5",
  primaryFg: "#262626",
};

const font =
  "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// inline styles = light; classes flip to dark where clients honor the media query (apple mail, outlook.com)
const darkCss = `
  @media (prefers-color-scheme: dark) {
    .k-page { background:${dark.page} !important; }
    .k-card { background:${dark.card} !important; border-color:${dark.border} !important; }
    .k-fg { color:${dark.fg} !important; }
    .k-muted { color:${dark.muted} !important; }
    .k-row { border-color:${dark.border} !important; }
    .k-link { text-decoration-color:${dark.muted} !important; }
    .k-frame { background:${dark.subtle} !important; border-color:${dark.border} !important; }
    .k-btn { background:${dark.primary} !important; }
    .k-btn a { color:${dark.primaryFg} !important; }
  }`;

export function layout({
  preview,
  body,
  footer,
}: {
  /** inbox preview line; hidden in the body */
  preview: string;
  body: string;
  footer?: string;
}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>${darkCss}</style>
</head>
<body class="k-page" style="margin:0;padding:0;background:${light.page};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="k-page" style="background:${light.page};">
<tr><td align="center" style="padding:40px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;font-family:${font};">
    <tr><td style="padding:0 4px 20px;">
      <span class="k-fg" style="font-size:16px;font-weight:700;letter-spacing:-0.02em;color:${light.fg};">Kanbi</span>
    </td></tr>
    <tr><td class="k-card" style="background:${light.card};border:1px solid ${light.border};border-radius:14px;padding:32px;">
      ${body}
    </td></tr>
    ${
      footer
        ? `<tr><td class="k-muted" style="padding:20px 4px 0;font-size:12px;line-height:18px;color:${light.muted};">${footer}</td></tr>`
        : ""
    }
  </table>
</td></tr>
</table>
</body>
</html>`;
}

export const eyebrow = (text: string) =>
  `<p class="k-muted" style="margin:0 0 8px;font-size:12px;line-height:16px;font-weight:500;color:${light.muted};">${esc(text)}</p>`;

export const heading = (text: string) =>
  `<h1 class="k-fg" style="margin:0 0 8px;font-size:20px;line-height:28px;font-weight:600;letter-spacing:-0.01em;color:${light.fg};">${esc(text)}</h1>`;

export const paragraph = (html: string) =>
  `<p class="k-muted" style="margin:0 0 16px;font-size:14px;line-height:22px;color:${light.muted};">${html}</p>`;

export const strong = (text: string) =>
  `<strong class="k-fg" style="font-weight:600;color:${light.fg};">${esc(text)}</strong>`;

/** table-wrapped so outlook keeps padding + radius */
export const button = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
  <tr><td class="k-btn" style="background:${light.primary};border-radius:8px;">
    <a href="${esc(href)}" style="display:inline-block;padding:10px 18px;font-size:14px;line-height:20px;font-weight:500;color:${light.primaryFg};text-decoration:none;border-radius:8px;">${esc(label)}</a>
  </td></tr>
</table>`;

export const divider = () =>
  `<div class="k-row" style="margin:28px 0 20px;border-top:1px solid ${light.border};height:0;line-height:0;font-size:0;">&nbsp;</div>`;

const note = (html: string) =>
  `<p class="k-muted" style="margin:0;font-size:12px;line-height:18px;color:${light.muted};">${html}</p>`;

/** raw url fallback for when the button is stripped */
export const linkFallback = (href: string) =>
  note(
    `Button not working? Paste this link into your browser:<br><a href="${esc(href)}" class="k-fg" style="color:${light.fg};text-decoration:underline;word-break:break-all;">${esc(href)}</a>`,
  );

/** coss Frame: bordered list, hairline-separated rows */
export const frame = (rows: string[]) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="k-frame" style="margin:20px 0 0;background:${light.subtle};border:1px solid ${light.border};border-radius:10px;border-collapse:separate;">
${rows
  .map(
    (row, i) =>
      `<tr><td class="k-row" style="padding:12px 14px;font-size:14px;line-height:20px;${i > 0 ? `border-top:1px solid ${light.border};` : ""}">${row}</td></tr>`,
  )
  .join("\n")}
</table>`;

export const tokens = light;
