# Kanbi

Kanbi is a super simple kanban-based project tracking tool — think Linear, but for personal use.

It borrows the parts of Linear that make it pleasant to live in day-to-day, while staying small enough to actually own and tweak yourself.

## Features

- Linear-inspired UX and UI — keyboard-friendly, fast, and out of the way
- Kanban boards with columns, drag-and-drop reordering, labels, priorities, due dates, and rich-text descriptions
- Board sharing and member invites with proper roles
- Proper authentication (email/password + sessions) via Better Auth
- Built for personal projects and small teams, not enterprise sprawl

## Stack

Bootstrapped with [create-t3-app](https://create.t3.gg/):

- [Next.js](https://nextjs.org)
- [Better Auth](https://better-auth.com)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Getting started

```bash
pnpm install
pnpm db:push
pnpm dev
```

## Deployment

See the T3 deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify), or [Docker](https://create.t3.gg/en/deployment/docker).
