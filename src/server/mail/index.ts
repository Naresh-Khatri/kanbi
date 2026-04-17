import "server-only";

import nodemailer from "nodemailer";

import { env } from "@/env";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
});

type SendInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

async function sendMail({ to, subject, text, html }: SendInput) {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

function appUrl() {
  return env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "";
}

const layout = (title: string, body: string) => `<!doctype html>
<html>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b0b0c;color:#e7e7e7;padding:32px;">
    <div style="max-width:520px;margin:0 auto;background:#141416;border:1px solid #222;border-radius:12px;padding:28px;">
      <h1 style="font-size:18px;margin:0 0 12px;">${title}</h1>
      ${body}
      <p style="color:#777;font-size:12px;margin-top:24px;">Kanbi</p>
    </div>
  </body>
</html>`;

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#fff;color:#0b0b0c;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600;">${label}</a>`;

export async function sendPasswordResetEmail(to: string, url: string) {
  const subject = "Reset your Kanbi password";
  const text = `Reset your password by visiting: ${url}\n\nIf you didn't request this, you can ignore this email.`;
  const html = layout(
    "Reset your password",
    `<p style="color:#bbb;">Click the button below to choose a new password. This link will expire soon.</p>
     <p style="margin:20px 0;">${button(url, "Reset password")}</p>
     <p style="color:#777;font-size:12px;">If you didn't request this, you can safely ignore this email.</p>`,
  );
  await sendMail({ to, subject, text, html });
}

export async function sendProjectInviteEmail(
  to: string,
  opts: { token: string; projectName: string; inviterName?: string | null },
) {
  const url = `${appUrl()}/invite/${opts.token}`;
  const who = opts.inviterName ? `${opts.inviterName} ` : "Someone ";
  const subject = `${who}invited you to ${opts.projectName} on Kanbi`;
  const text = `${who}invited you to collaborate on "${opts.projectName}".\n\nAccept: ${url}`;
  const html = layout(
    `You've been invited to ${opts.projectName}`,
    `<p style="color:#bbb;">${who}invited you to collaborate on <strong>${opts.projectName}</strong> on Kanbi.</p>
     <p style="margin:20px 0;">${button(url, "Accept invite")}</p>
     <p style="color:#777;font-size:12px;">Or paste this link in your browser: ${url}</p>`,
  );
  await sendMail({ to, subject, text, html });
}
