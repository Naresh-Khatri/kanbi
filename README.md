# Kanbi

A super simple kanban-based project tracker. Think Linear, but small enough to
own and tweak yourself. It keeps the parts of Linear that make it pleasant to
live in day to day (keyboard-first, fast, realtime) without the enterprise
sprawl.

This is a pnpm + Turborepo monorepo:

```
kanbi/
  apps/web          Next.js 15 app, the product (tRPC, Drizzle/Postgres, Better Auth)
  apps/focus        Expo companion app (pairs over QR, talks to the web tRPC API)
  packages/shared   types shared between web and focus
```

## Features

- **Boards** with columns, drag-and-drop reordering of columns and tasks, and
  fractional positions (no integer reshuffles).
- **Tasks** with priorities, labels, due dates, checklists, assignees, and
  rich-text descriptions (Tiptap) supporting `@mentions` and `#ticket`
  references.
- **Comments** on tasks, with mentions that notify project members.
- **Realtime** updates and online presence over SSE; the UI is optimistic and
  deletes are undoable.
- **Keyboard-first** with a command palette and shortcuts throughout.
- **Projects** with member invites, roles, and per-project settings; plus
  public read-only shared boards via a share link.
- **AI task drafting** (optional): paste a client message and let Groq extract
  actionable issues with title, description, label, and priority.
- **Focus app**: an Expo companion that pairs to your account over a QR code and
  authenticates with per-device tokens.
- **MCP server**: connect AI agents (Claude Code, opencode) over OAuth so they
  can read and write your boards. See
  [`apps/web/src/server/mcp/README.md`](apps/web/src/server/mcp/README.md).
- **Auth**: email/password plus Google and GitHub OAuth, via Better Auth.

## Tech stack

Next.js 15 (App Router) - tRPC v11 + TanStack Query - Drizzle ORM on Postgres -
Better Auth - Tailwind v4 with shadcn/Radix - dnd-kit - Zustand - Tiptap.
Turborepo + pnpm; the companion app is Expo / React Native.

## Getting started

### Prerequisites

- Node 20+
- pnpm 10 (`corepack enable` picks up the pinned version)
- A Postgres database (local or hosted, e.g. Neon)

### Setup

```bash
git clone <repo-url> kanbi && cd kanbi
pnpm install

cp apps/web/.env.example apps/web/.env   # then set DATABASE_URL (rest is optional)
pnpm db:push                             # create the schema in your database
pnpm dev:web                             # http://localhost:3333
```

The web app runs on **port 3333**.

### Environment

`apps/web/src/env.js` validates env at startup (empty strings count as unset).
Only `DATABASE_URL` is required to boot; `BETTER_AUTH_SECRET` is additionally
required in production (`openssl rand -base64 32`).

Everything else is optional and gates one feature:

| Variable                                        | Enables                                                                                |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `BETTER_AUTH_URL`                               | OAuth redirects and the MCP server (your origin, e.g. `http://kanbi.localhost:3333`).  |
| `BETTER_AUTH_GITHUB_*` / `BETTER_AUTH_GOOGLE_*` | Social login (each provider needs both its id and secret).                             |
| `SMTP_*`                                        | Transactional email (password reset, invites, digests); unset means sends are skipped. |
| `R2_*`                                          | Task attachments (Cloudflare R2 / S3-compatible).                                      |
| `GROQ_API_KEY`                                  | The AI task drafter.                                                                   |
| `CRON_SECRET`                                   | Auth for the `/api/cron/*` endpoints.                                                  |
| `MCP_RESOURCE_URL`                              | Override the MCP OAuth audience (defaults to `<BETTER_AUTH_URL>/api/mcp`).             |

See `apps/web/.env.example` for the full list.

## Commands

Run from the repo root:

```bash
pnpm dev:web        # web app only (port 3333, turbopack)
pnpm dev            # all apps via turbo
pnpm dev:focus      # Expo companion app
pnpm build          # build all apps
pnpm lint           # next lint
pnpm typecheck      # tsc --noEmit
pnpm format:write   # prettier

pnpm db:push        # push the Drizzle schema (the dev workflow)
pnpm db:generate    # generate a migration
pnpm db:migrate     # run migrations
pnpm db:studio      # Drizzle Studio
```

There is no test suite.

## Connect an AI agent

Kanbi ships an MCP server at `/api/mcp` so agents can manage your boards from an
editor or terminal. Quick version for Claude Code:

```bash
claude mcp add --transport http kanbi http://kanbi.localhost:3333/api/mcp
```

Then run a tool and approve the browser consent screen. The full guide (opencode
setup, tool/scope reference, troubleshooting) lives in
[`apps/web/src/server/mcp/README.md`](apps/web/src/server/mcp/README.md).

## Documentation

- **[AGENTS.md](AGENTS.md)** - architecture and conventions for working in the
  codebase.
- **[DESIGN.md](DESIGN.md)** - the design language (read before any UI work).
- **[apps/web/src/server/mcp/README.md](apps/web/src/server/mcp/README.md)** -
  the MCP server: connecting agents, tools, scopes, troubleshooting.
- **[TODO.md](TODO.md)** - known gaps and half-finished features.
