import "server-only";

import nodemailer from "nodemailer";

import { env } from "@/env";
import {
  button,
  divider,
  esc,
  eyebrow,
  frame,
  heading,
  layout,
  linkFallback,
  paragraph,
  strong,
  tokens,
} from "@/server/mail/layout";

// SMTP is optional; build the transport only when it's configured so the app
// still runs without mail credentials (sends become no-ops below).
const transporter =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD
    ? nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      })
    : null;

type SendInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendMail({ to, subject, text, html }: SendInput) {
  if (!transporter || !env.SMTP_FROM) {
    console.warn(`[mail] SMTP not configured; skipped "${subject}" to ${to}`);
    return;
  }
  await transporter.sendMail({ from: env.SMTP_FROM, to, subject, text, html });
}

function appUrl() {
  return env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "";
}

export async function sendPasswordResetEmail(to: string, url: string) {
  const subject = "Reset your Kanbi password";
  const text = `Reset your Kanbi password:\n${url}\n\nThis link expires soon. If you didn't request a reset, ignore this email.`;
  const html = layout({
    preview: "Use this link to choose a new password.",
    body: [
      heading("Reset your password"),
      paragraph(
        "Use the button below to choose a new password. The link expires soon.",
      ),
      button(url, "Reset password"),
      divider(),
      linkFallback(url),
    ].join(""),
    footer:
      "Didn't request this? Ignore this email and your password stays the same.",
  });
  await sendMail({ to, subject, text, html });
}

type DigestHighlightLine = {
  actor: string | null;
  action: string;
  task: string | null;
  taskId?: string | null;
};

function highlightToText(h: DigestHighlightLine) {
  return [h.actor, h.action, h.task ? `"${h.task}"` : null]
    .filter(Boolean)
    .join(" ");
}

function highlightToHtml(h: DigestHighlightLine, boardUrl: string) {
  const task = h.task
    ? h.taskId
      ? `<a href="${esc(`${boardUrl}?task=${encodeURIComponent(h.taskId)}`)}" class="k-fg k-link" style="color:${tokens.fg};font-weight:500;text-decoration:underline;text-decoration-color:${tokens.muted};text-underline-offset:3px;">${esc(h.task)}</a>`
      : `<span class="k-fg" style="color:${tokens.fg};font-weight:500;">${esc(h.task)}</span>`
    : null;
  const parts = [
    h.actor ? strong(h.actor) : null,
    `<span class="k-muted" style="color:${tokens.muted};">${esc(h.action)}</span>`,
    task,
  ];
  return parts.filter(Boolean).join(" ");
}

export async function sendDigestEmail(
  to: string,
  opts: {
    boardName: string;
    slug: string;
    headline: string;
    summary: string;
    highlights: DigestHighlightLine[];
  },
) {
  const url = `${appUrl()}/app/p/${opts.slug}`;
  const subject = `Weekly digest: ${opts.boardName}`;
  const bullets = opts.highlights
    .map((h) => `- ${highlightToText(h)}`)
    .join("\n");
  const text = `${opts.headline}\n\n${opts.summary}${
    bullets ? `\n\n${bullets}` : ""
  }\n\nOpen the board: ${url}`;
  const html = layout({
    preview: opts.summary,
    body: [
      eyebrow(`Weekly digest · ${opts.boardName}`),
      heading(opts.headline),
      paragraph(esc(opts.summary)),
      opts.highlights.length > 0
        ? frame(opts.highlights.map((h) => highlightToHtml(h, url)))
        : "",
      button(url, "Open board"),
    ].join(""),
    footer: `You're getting this because weekly digests are on for ${strong(opts.boardName)}. Turn them off in the project settings.`,
  });
  await sendMail({ to, subject, text, html });
}

export async function sendProjectInviteEmail(
  to: string,
  opts: { token: string; projectName: string; inviterName?: string | null },
) {
  const url = `${appUrl()}/invite/${opts.token}`;
  const who = opts.inviterName ?? "Someone";
  const subject = `${who} invited you to ${opts.projectName} on Kanbi`;
  const text = `${who} invited you to collaborate on "${opts.projectName}" on Kanbi.\n\nAccept the invite: ${url}`;
  const html = layout({
    preview: `${who} invited you to collaborate on ${opts.projectName}.`,
    body: [
      eyebrow("Project invite"),
      heading(`Join ${opts.projectName} on Kanbi`),
      paragraph(
        `${strong(who)} invited you to collaborate on ${strong(opts.projectName)}. Accept to see its board and docs.`,
      ),
      button(url, "Accept invite"),
      divider(),
      linkFallback(url),
    ].join(""),
    footer: `Sent to ${esc(to)}. Not expecting this? You can ignore it.`,
  });
  await sendMail({ to, subject, text, html });
}
