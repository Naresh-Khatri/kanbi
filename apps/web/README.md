# Kanbi

Kanbi is a kanban project tracker built for working alongside AI agents. You plan and assign; coding agents connect over MCP, pick up their tasks, and report back on the card.

It stays small enough to actually own and tweak yourself.

## Features

- MCP server for AI agents — capture tasks from a conversation, then let the agent work its queue and hand off for review
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
pnpm dev:web   # http://kanbi.localhost:3333
```

## Deployment

Deploy as a single long-running Node instance with Docker: build from the repo root with `apps/web/Dockerfile` (Next.js `standalone` output). Migrations run on boot. Serverless hosts (Vercel, Netlify) are not supported: the realtime bus is in-process, see `TODO.md`.
