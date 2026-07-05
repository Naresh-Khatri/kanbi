# AGENTS.md

This file provides guidance to coding agents when working with code in this repository.

## Overview

Kanbi is a kanban app in a pnpm + Turborepo monorepo. Almost all work happens in **`apps/web`** — a Next.js 15 App Router app (T3-stack derived). `apps/focus` is an Expo companion app that talks to the web app's tRPC API via `kbf_` bearer device tokens; `packages/shared` exports only the QR pairing payload type (`PairPayload`) shared between them.

## Commands

Run from the repo root (pnpm 10, turbo):

```bash
pnpm dev:web          # dev server for web only (port 3333, turbopack)
pnpm build            # turbo build (all apps)
pnpm lint             # next lint (web)
pnpm typecheck        # tsc --noEmit
pnpm format:write     # prettier (has tailwind class sorting plugin)

pnpm db:push          # push Drizzle schema to Postgres (dev workflow)
pnpm db:generate      # generate migration files
pnpm db:migrate       # run migrations
pnpm db:studio        # Drizzle Studio
```

There is no test suite. Inside `apps/web` you can also run `pnpm lint:fix`. Env vars are validated at startup by `src/env.js` (t3-env + Zod); `SKIP_ENV_VALIDATION=1` bypasses it (used in Docker builds). Empty-string env vars are treated as undefined.

## Web app architecture (`apps/web/src`)

Stack: Next.js 15 App Router, tRPC v11 + TanStack Query, Drizzle ORM on Postgres (`pg` pool), Better Auth, Tailwind v4 + shadcn/Radix, dnd-kit, Zustand, Tiptap, Sonner.

### Data flow

- **All API traffic goes through tRPC** — no server actions, no REST except the Better Auth catch-all (`/api/auth/[...all]`), the tRPC adapter (`/api/trpc/[trpc]`), and the cron endpoint (`/api/cron/notifications`, guarded by `CRON_SECRET`).
- Server components call `api.*` from `src/trpc/server.ts` (React `cache()` + `createCaller`, `server-only`); client components use `src/trpc/react.tsx`.
- `src/server/api/root.ts` composes ~15 domain routers from `src/server/api/routers/` (board, column, task, label, checklist, attachment, comment, share, activity, realtime, notification, device, focus, project, user).
- **Procedure types** in `src/server/api/trpc.ts` encode authorization: `protectedProcedure`, `projectProcedure` (membership via project ID), `boardProcedure` (membership via board ID), `publicBoardProcedure` (share token, no auth). Role checks inside handlers use `assertCanWrite` / `assertCanAdmin` from `src/server/api/permissions.ts`. Use the matching procedure type when adding endpoints.
- The tRPC context also accepts `Authorization: Bearer kbf_…` device tokens (SHA-256 hashed in DB) and synthesizes a session — this is how the Focus app authenticates.

### Database

- Schema lives entirely in `src/server/db/schema.ts`. App tables use `pgTableCreator` with a `kanbi_` prefix; Better Auth tables (`user`, `session`, `account`, `verification`) are unprefixed and owned by the adapter.
- IDs are nanoid text. **Ordering uses fractional positions**: columns/tasks have a `real` position column; insertion uses midpoints via `src/lib/position.ts` (`positionBetween`, `positionAtEnd`, `needsRebalance`) — never integer sequences.
- `src/server/db/index.ts` pins the `pg.Pool` on `globalThis` in dev to survive hot reload.

### Auth

Better Auth (`src/server/better-auth/`): `config.ts` (email/password + Google + GitHub OAuth, drizzle adapter, 5-min cookie cache), `server.ts` (`getSession()`, cache-wrapped), `client.ts` (browser client). The auth guard is `src/app/app/layout.tsx` — a server component that redirects to `/login` when there is no session.

### Realtime

- tRPC subscriptions over SSE: the client splits links in `src/trpc/react.tsx` (`httpSubscriptionLink` for subscriptions, `httpBatchStreamLink` otherwise).
- Server side is an in-process `EventEmitter` bus (`src/server/realtime/bus.ts`, pinned to `globalThis.__kanbiBus`) with `emitBoard`/`emitUser`. **Every mutating router must call `bus.emitBoard(boardId, { scope, ids })` after writing**, and `src/server/api/routers/realtime.ts` yields these to subscribed clients, which respond by invalidating TanStack Query caches (events never carry data).
- Note: the bus is single-instance only; multi-instance deploys would need Redis/LISTEN-NOTIFY (tracked in TODO.md).

### Routes

- `/` plus `/login`, `/signup`, etc. — marketing/auth surfaces.
- `/app/(dashboard)/` — project list, profile.
- `/app/p/[slug]/` — the board (the heart of the app), `/app/p/[slug]/settings/`.
- `/b/[token]/` — public read-only shared board (no auth); `/invite/[token]/` — invite acceptance.
- Conventions: `_components/` holds route-private client components; `_lib/` holds server-only route helpers (e.g. `resolve-project.ts`). Pages/layouts are server components that prefetch via the server caller; interactivity lives in `"use client"` files under `_components/`.

### Board feature (`src/app/app/p/[slug]/_components/board/`)

- `board-view.tsx` orchestrates everything: dnd-kit DnD (sortable columns horizontally, tasks vertically; `closestCenter` for columns, `closestCorners` for tasks), filters, realtime subscription, open-task state. Types in `board-types.ts` derive from `RouterOutputs["board"]["get"]`.
- **Mutations are optimistic**: `onMutate` cancels queries, snapshots, writes to the TanStack Query cache; `onError` rolls back; `onSettled` invalidates. Follow this pattern for new board mutations.
- Deletes are undoable (`use-undoable-board-delete.ts`): remove from cache immediately, defer the server mutation 6s, Sonner toast with Undo restores the snapshot.
- Cross-component signals (create-task, AI import, command palette) go through the Zustand store `src/components/keybinds/shell-store.ts` (`useAppShell`).

### AI

`src/server/ai/mistral.ts` (server-only) uses the Mistral SDK to draft structured tasks; only active when `MISTRAL_API_KEY` is set — treat the feature as optional.

### MCP server

`src/server/mcp/` exposes a Model Context Protocol server at `/api/mcp` (Streamable HTTP) so external agents (Claude Code, opencode) can read and write boards. Auth is OAuth 2.1 via `@better-auth/oauth-provider`, registered alongside the `jwt()` plugin in `src/server/better-auth/config.ts`: agents self-register (RFC 7591 DCR), the user consents at `/consent`, and the route (`src/app/api/[transport]/route.ts`) verifies the resulting JWT against the JWKS. Tools wrap existing tRPC procedures through a JWT-to-session bridge (`caller.ts`), so ACLs, validation, and the realtime bus are all reused; per-tool checks gate the `kanbi:read` vs `kanbi:write` scopes. Agent-authored HTML is sanitized server-side (`sanitize.ts`). The `oauth_*` and `jwks` tables are unprefixed (owned by the Better Auth adapter); OAuth discovery docs live under `src/app/.well-known/`, served at both the root and the RFC-path-aware locations. **See `src/server/mcp/README.md`** for connecting agents, the tool/scope reference, and troubleshooting.

## Design language

**Read `DESIGN.md` before any UI work.** Key rules: dark-only UI; monochrome alpha ladder (`text-white/70`, `border-white/10`, `bg-white/5`) instead of new colors — color is reserved for meaning (priority/status/focus); two dialects — marketing pages get gradients/pill buttons/display type, product pages under `/app` are flat near-black, hairline borders, dense, `rounded-md`; no hover scale/shadow, minimal motion; keyboard-first (shortcuts via `react-hotkeys-hook`).

Tailwind v4 is configured in `src/styles/globals.css` (`@theme` blocks, no `tailwind.config.ts`). Shared primitives live in `src/components/ui/`.

## Other notes

- `next.config.js` uses `output: "standalone"` with `outputFileTracingRoot` at the monorepo root (Docker builds from the repo root with `apps/web/Dockerfile`).
- React/react-dom are pinned to 19.2.7 via pnpm overrides in the root package.json.
- `TODO.md` tracks known gaps and half-finished features (schema fields with no UI, etc.) — check it before assuming a feature is missing or before adding schema.
