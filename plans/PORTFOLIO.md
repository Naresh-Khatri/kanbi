# Kanbi — Portfolio Writeup

## One-liner
**Kanbi** — a keyboard-first, realtime Kanban project tracker ("Linear, but small
enough to own"), built as a full-stack TypeScript monorepo with a Next.js web app,
an AI-agent integration over MCP, and an Expo companion app featuring a custom
native Android dock dashboard.

## Short blurb (for a project card)
A production-grade Kanban/issue tracker with optimistic realtime collaboration,
end-to-end type safety, layered authorization, AI-assisted task drafting, and a
native mobile companion. Spans a Next.js 15 web product, an OAuth-secured MCP
server that lets AI coding agents read/write boards, and an Expo app that turns a
docked phone into a live focus dashboard.

---

## At-a-glance metrics
- **~21K lines** of TypeScript across the monorepo (148 files in the web app alone)
- **3 deployable surfaces** in one repo: web app, MCP server, mobile app
- **16 domain tRPC routers**, **25 database tables**, **8 MCP agent tools**
- **113 commits** of focused, incremental work
- **End-to-end type-safe** from Postgres → tRPC → React, no codegen drift

---

## Tech stack
**Web:** Next.js 15 (App Router, RSC) · TypeScript · tRPC v11 · TanStack Query ·
Drizzle ORM · PostgreSQL · Better Auth · Tailwind CSS v4 · shadcn/Radix UI ·
dnd-kit · Zustand · Tiptap · Zod · superjson · Sonner

**Mobile:** Expo (SDK 55) · React Native 0.83 · expo-router · NativeWind ·
custom native Android module (Kotlin)

**AI / Agents:** Model Context Protocol (MCP) server · OAuth 2.1 · Mistral LLM SDK

**Infra / tooling:** pnpm workspaces · Turborepo · Docker (standalone output) ·
Cloudflare R2 / S3 · t3-env runtime env validation · cron-driven email digests

---

## Headline features (recruiter-facing)
1. **Realtime collaborative boards** — drag-and-drop columns and cards with
   optimistic UI, live multi-user updates, and online-presence indicators.
2. **Keyboard-first UX** — command palette (⌘K) and single-key shortcuts
   throughout; designed so power users rarely touch the mouse.
3. **Rich task model** — priorities, labels, due dates, checklists, assignees,
   rich-text descriptions with `@mentions` and `#ticket` cross-references, threaded
   comments, and file attachments.
4. **AI task drafting** — paste a raw client message and an LLM extracts
   structured, actionable issues (title, description, label, priority).
5. **AI-agent integration (MCP)** — connect Claude Code / any MCP client over
   OAuth so agents can read and write your boards from an editor or terminal.
6. **Native mobile companion** — pair by QR, then dock your phone to turn it into
   a live "focus dashboard" showing the active task and a Pomodoro timer.
7. **Teams & sharing** — projects with member invites, roles/permissions, and
   public read-only shared boards via a share link.

---

## Technical highlights (engineer-facing — the depth that impresses)

### Architecture & type safety
- **End-to-end type-safe full-stack** in a single language: Drizzle ORM infers
  types from the Postgres schema, tRPC v11 surfaces them as a typed API, and
  React Query consumes `RouterOutputs` — a schema change ripples to compile errors
  in the UI with zero codegen.
- **pnpm + Turborepo monorepo** with three workspaces (`apps/web`, `apps/focus`,
  `packages/shared`) and a shared types package; cached, parallelized builds.

### Authorization (defense in depth)
- **Layered tRPC procedure types** encode access control at the type level:
  `protectedProcedure` → `projectProcedure` (project membership) →
  `boardProcedure` (board membership) → `publicBoardProcedure` (share token, no
  auth). Role checks (`assertCanWrite` / `assertCanAdmin`) gate mutations.
- A single authorization model is **reused across three entry points** — the web
  UI, the MCP agent tools, and the mobile device tokens — so ACLs can't drift.

### Realtime engine
- **tRPC subscriptions over Server-Sent Events**, with the client splitting
  transport links (subscription link vs. batched-stream link).
- An in-process **event bus** broadcasts `boardId`-scoped invalidation signals;
  events carry *no data* (only "what changed"), so clients invalidate and refetch
  through React Query — keeping the realtime layer cheap and consistent.
- **Optimistic mutations** with snapshot/rollback (`onMutate`/`onError`/
  `onSettled`) and **undoable deletes** (6-second deferred server call + toast).

### Algorithms & data modeling
- **Fractional indexing** for ordering: columns/cards store a `real` position and
  new items are inserted at the midpoint between neighbors (`positionBetween`),
  with collapse detection and rebalancing — reordering touches **one row**, never
  a re-sequence of the whole list.
- 25-table relational schema with nanoid IDs, activity log, notifications, and
  digest tables.

### Auth & identity
- **Better Auth** with email/password, Google, and GitHub OAuth, cookie-session
  caching, and a Drizzle adapter.
- **Three authentication modalities** unified into one session abstraction:
  browser cookies, hashed per-device bearer tokens (`kbf_…`, SHA-256 at rest) for
  mobile, and OAuth-2.1 JWTs for AI agents.

### MCP server for AI agents (standout)
- A spec-compliant **Model Context Protocol server** (Streamable HTTP) exposing
  8 tools across `read`/`write` scopes, letting external AI agents manage boards.
- **Full OAuth 2.1 flow**: dynamic client registration (RFC 7591), a browser
  consent screen, JWT access tokens verified against JWKS, RFC 9728 protected-
  resource discovery docs — *no API keys to copy/paste*, and access is revocable
  per agent.
- Each tool is a **thin wrapper over the existing tRPC procedures via a
  JWT→session bridge**, so permissions, validation, fractional ordering, and the
  realtime bus are all reused; agent-authored HTML is server-side sanitized.

### Native mobile engineering (standout)
- **Custom native Android Expo module written in Kotlin** that implements
  Android's `DreamService` (the system daydream/screensaver). When the phone is
  docked and idle, the OS launches a React Native root view rendering the active
  task and Pomodoro timer — a genuine **dock dashboard**, with `showWhenLocked`,
  screen-on, and keyguard-dismissal handled natively.
- QR-code device pairing flow with secure token storage (`expo-secure-store`).

### Product engineering & polish
- **File attachments** via presigned URLs to Cloudflare R2 / S3 (direct browser
  upload, no proxying through the server).
- **Transactional + digest email** (invites, password reset, notification
  digests) via SMTP, driven by a `CRON_SECRET`-guarded cron endpoint.
- **Rich text** powered by Tiptap with mention and ticket-reference extensions.
- A documented, **opinionated design system** (`DESIGN.md`): dark-only,
  monochrome alpha-ladder tokens, "color is meaning," two distinct dialects for
  marketing vs. product surfaces.
- **Runtime env validation** (t3-env + Zod) and **Dockerized** standalone builds;
  every optional integration (AI, email, R2, OAuth, MCP) degrades gracefully when
  unconfigured.

---

## Resume bullet points (pick 3–5)
- Built **Kanbi**, a realtime Kanban project tracker as a full-stack TypeScript
  monorepo (Next.js 15, tRPC, Drizzle/Postgres, Expo) — ~21K LOC across web, MCP,
  and mobile surfaces.
- Engineered an **optimistic realtime collaboration layer** using tRPC
  subscriptions over SSE with an event-driven invalidation bus, snapshot/rollback
  mutations, and undoable deletes.
- Designed a **layered, type-safe authorization model** (project/board/share/
  device/agent) reused across web, mobile, and AI-agent clients to prevent ACL
  drift.
- Implemented an **OAuth-2.1-secured MCP server** that lets AI coding agents read
  and write boards through 8 scoped tools, wrapping existing tRPC procedures via a
  JWT→session bridge.
- Wrote a **custom native Android module in Kotlin** (`DreamService`) turning a
  docked phone into a live focus dashboard for the Expo companion app.
- Applied **fractional indexing** for O(1) drag-and-drop reordering and modeled a
  25-table relational schema with Drizzle ORM.

---

## Suggested talking points for interviews
- *Why three auth modalities collapse into one session* → trade-offs of unifying
  cookies, device tokens, and OAuth JWTs behind a single `protectedProcedure`.
- *Why realtime events carry no payload* → consistency vs. bandwidth; React Query
  as the single source of truth.
- *Fractional indexing vs. integer positions* → why midpoint insertion beats
  re-sequencing, and when rebalancing kicks in.
- *Building an MCP server* → reusing business logic so agents can't bypass ACLs,
  and the security boundary around agent-authored content.
- *DreamService deep-dive* → bridging native Android lifecycle with a React Native
  root view.
