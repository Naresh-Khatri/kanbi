# Kanbi

Kanbi is a super simple kanban-based project tracking tool — think Linear, but for personal use.

It borrows the parts of Linear that make it pleasant to live in day-to-day, while staying small enough to actually own and tweak yourself.

## Features

- Linear-inspired UX and UI — keyboard-friendly, fast, and out of the way
- Kanban boards with columns, drag-and-drop reordering, labels, priorities, due dates, and rich-text descriptions
- Board sharing and member invites with proper roles
- Proper authentication (email/password + sessions) via Better Auth
- AI task drafting — paste a client message, let an LLM (Groq `gpt-oss-20b`) extract actionable issues with title, description, label, and priority. Shift+V on any board, or the command palette.
- Built for personal projects and small teams, not enterprise sprawl

## Stack

Bootstrapped with [create-t3-app](https://create.t3.gg/):

- [Next.js](https://nextjs.org)
- [Better Auth](https://better-auth.com)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)
- [Groq](https://console.groq.com) — powers AI drafting, Ask Docs and digests via its free `openai/gpt-oss-20b` model (optional; set `GROQ_API_KEY`)
- [OpenRouter](https://openrouter.ai) — free fallback via the `openrouter/free` router (optional; set `OPENROUTER_API_KEY`)

## Getting started

```bash
pnpm install
pnpm db:push
pnpm dev
```

## Deployment

See the T3 deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify), or [Docker](https://create.t3.gg/en/deployment/docker).
