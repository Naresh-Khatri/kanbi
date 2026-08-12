# Plan 005: Ship project-native Docs with safe editing and task backlinks

> **Executor instructions**: Read this plan fully before changing code. Follow
> the steps in order and run every verification gate. Do not broaden the MVP
> with comments, templates, public pages, per-page permissions, or collaborative
> cursors. If a STOP condition occurs, report it instead of improvising.
>
> **Drift check (run first)**:
> `git status --short && git diff --stat ced60c8..HEAD -- apps/web/src/server/db/schema.ts apps/web/src/server/api/root.ts apps/web/src/components/ui/rich-text-editor.tsx apps/web/src/components/ui/rich-text-mention.tsx apps/web/src/components/command/command-palette.tsx apps/web/src/app/app/p/[slug]`
> This plan was written while unrelated hidden-column work was uncommitted and
> already touched `schema.ts` and board files. Do not begin implementation until
> that work is committed or otherwise reconciled. Never discard it.

## Status

- **Priority**: P1
- **Effort**: L (roughly 8–12 focused engineering days for the MVP)
- **Risk**: MED — new persistent content, hierarchy, revision history, and edits
  to shared rich-text code
- **Depends on**: Plan 001 (the hierarchy, link extraction, and
  optimistic-version helpers need unit tests)
- **Category**: direction / product
- **Planned at**: commit `ced60c8`, 2026-08-12, with a dirty working tree noted
  in the drift check

## Outcome

Every Kanbi project has a **Docs** surface beside **Board**. Project members can
browse a simple page tree, read and search pages, and reference the work already
tracked on the board. Editors and owners can create, move, and safely edit pages.
Each explicit save creates a recoverable revision. When a page references a
ticket, the task shows that page as related context.

This is deliberately a project knowledge layer, not a small clone of all of
Confluence or Notion. Kanbi's advantage is that the knowledge and the work share
the same project, membership, editor language, and command palette, and can
later share the existing agent API without inventing another permission model.

## Product assumptions to validate

- **Primary users**: small product/engineering teams already organizing work in
  a Kanbi project.
- **Core job**: keep durable context—briefs, decisions, runbooks, meeting notes,
  and implementation guidance—next to the tasks it explains.
- **Primary success signal**: a user can go from a task to its supporting page,
  or find a page from search, without leaving the project or duplicating links.
- **Fidelity**: production MVP, preceded by a low-fidelity workflow test.

Before implementation, test a clickable or paper prototype with 5 users using
these tasks:

1. Create a project brief under a parent page.
2. Reference ticket `KEY-12` from the brief.
3. Open the brief again from the task.
4. Find a runbook without knowing where it sits in the tree.
5. Recover an earlier version after making a bad edit.

Targets: at least 4/5 complete each task without help; median time under 45
seconds for tasks 2–4; no participant expects a separate permission model.
If users consistently ask for global/team docs rather than project docs, STOP
and revisit the scope before creating schema.

## Product decisions

### Vocabulary and location

- Navigation label: **Docs**.
- Stored objects: **pages** in UI copy; code and database symbols use
  `projectDocument` / `document` to avoid collision with generic app pages.
- Scope: one document tree per existing project. Do not add Confluence-style
  spaces or a global wiki in the MVP.
- Routes:
  - `/app/p/[slug]` — Board (unchanged)
  - `/app/p/[slug]/docs` — Docs home / recent pages / empty state
  - `/app/p/[slug]/docs/[documentId]` — page reader and editor

### Editing model

- Reading is the default state.
- Editors click **Edit** (or use the command palette), then **Save** or **Cancel**.
- `Cmd/Ctrl+S` saves; `Esc` cancels after a discard confirmation when dirty.
- Do not autosave every keystroke in this version. Explicit versioned saves are
  simpler, avoid realtime merge semantics, and make recovery understandable.
- Updates use an `expectedVersion` compare-and-swap. A stale editor must receive
  `CONFLICT` and must never overwrite newer content.

### Hierarchy

- Pages have an optional parent and fractional sibling position.
- Creation supports “new root page” and “new child page.”
- Moving uses a small **Move to…** dialog with parent selection and sibling
  placement. Do not add drag-and-drop to the tree in the MVP.
- The server rejects self-parenting and descendant cycles.
- Archiving/deleting is deferred until a subtree-safe archive/restore design is
  implemented. Shipping no delete is safer than silently orphaning descendants.

### Intentional board integration

- Docs reuse the existing Tiptap rich-text behavior, `@` member mentions, and
  `#` ticket mentions.
- Saving a page extracts valid ticket mention nodes and maintains a normalized
  `documentTaskLink` join table.
- A task detail sheet has a compact **Docs** section listing pages that reference
  it. This is the backlink; users do not manually attach the same URL twice.
- Ticket chips read inside Docs navigate to `/app/p/[slug]?task=<id>` and open
  the existing task sheet.
- Global `Cmd/Ctrl+K` search includes Docs beside Projects and Tasks.
- Do not automatically inject all docs into AI prompts. That is expensive,
  unpredictable, and makes private project conventions hard to reason about.

## Explicit non-goals for the MVP

- No databases, tables, whiteboards, canvases, or arbitrary custom properties.
- No independent spaces or cross-project page trees.
- No per-page permissions; project owner/editor/viewer roles remain authoritative.
- No public publishing or anonymous share links.
- No realtime collaborative cursors or CRDT.
- No inline comments, subscriptions, notifications, reactions, or approvals.
- No templates, page verification badges, favorites, or page analytics.
- No document file attachments. Generalize the task-only R2 attachment model in
  a later slice after page usage proves the need.
- No AI authoring UI. MCP read/write support comes after the browser workflow is
  stable and is listed under follow-ups.

## Information architecture and interaction specification

Desktop layout:

```text
Project header:  [Project switcher]  Board  Docs        Team  Settings
---------------------------------------------------------------------
Docs sidebar (256px)        Page surface (max ~800px reading width)
[Search docs] [+ New]       Breadcrumbs
Recently updated            Title                     Edit  •••
▾ Product                    Updated by … at …
  Project brief             -----------------------------------------
  ▾ Decisions               Rich text content
    ADR-001                  ...
Runbooks                    Referenced tickets
```

- Keep the product dialect from `DESIGN.md`: near-black, hairlines,
  `rounded-md`, alpha ladder, no decorative gradients or hover scaling.
- The tree is dense and quiet. Selected page uses `bg-white/5`; indentation and
  disclosure chevrons carry hierarchy.
- On narrow screens, the tree becomes a drawer; the content remains the primary
  surface.
- Docs home shows a create button plus the 6 most recently updated pages. Do not
  manufacture an “Overview” page for every existing project.
- Empty state copy: “Keep project decisions, briefs, and runbooks next to the
  work.” One primary action: **Create first page**.
- The editor should expose headings, lists, quote, code, link, member mention,
  and ticket mention. A compact persistent toolbar is appropriate for long-form
  Docs, while task descriptions retain the existing selection bubble menu.
- Show a restrained save state: `Editing`, `Saving…`, `Saved`, or `Conflict`.
- History opens a right-side sheet with version number, editor, and timestamp.
  Selecting a revision previews it; **Restore this version** creates a new head
  revision rather than deleting history.

## Data model

Add these app-prefixed tables to `apps/web/src/server/db/schema.ts`.

### `projectDocument`

| Column                   | Shape                           | Notes                                                   |
| ------------------------ | ------------------------------- | ------------------------------------------------------- |
| `id`                     | text PK / nanoid                | Stable route identifier; title changes never break URLs |
| `projectId`              | FK project, cascade             | Permission and lifecycle boundary                       |
| `parentId`               | nullable self-FK, set null      | Must point to a page in the same project                |
| `title`                  | text, non-empty, max 160 in API | Duplicate titles are allowed                            |
| `body`                   | text, default empty paragraph   | Sanitized Tiptap HTML, max 250 KB in API                |
| `searchText`             | text, default empty             | Server-derived plain text for simple search             |
| `position`               | real                            | Use `positionAtEnd` / `positionBetween`                 |
| `version`                | integer, default 1              | Compare-and-swap edit guard                             |
| `createdById`            | FK user                         | Audit ownership                                         |
| `updatedById`            | FK user                         | Last editor metadata                                    |
| `createdAt`, `updatedAt` | timestamptz                     | Match existing helpers                                  |

Indexes: `(projectId, parentId, position)`, `(projectId, updatedAt)`. Do not make
title unique.

### `documentRevision`

| Column          | Shape                | Notes                       |
| --------------- | -------------------- | --------------------------- |
| `id`            | text PK              | —                           |
| `documentId`    | FK document, cascade | —                           |
| `version`       | integer              | Unique with `documentId`    |
| `title`, `body` | text                 | Complete immutable snapshot |
| `editorId`      | FK user              | Who saved/restored it       |
| `createdAt`     | timestamptz          | Revision timestamp          |

Create revision 1 in the same transaction as the page. Each later save or
restore appends exactly one revision.

### `documentTaskLink`

Composite primary key `(documentId, taskId)`, with cascading foreign keys and
an index on `taskId`. The server derives this table from canonical ticket nodes;
clients never submit arbitrary link rows.

Do not add document fields to `activity` in this slice. Revisions already answer
who changed a page, and the current digest assumes activity entries are task
events. Mixing document verbs into it without updating the digest would be an
accidental integration.

## API contract

Create `apps/web/src/server/api/routers/document.ts` and register it as
`document` in `root.ts`.

All project-local procedures must use `projectProcedure` and verify that every
`documentId`/`parentId` belongs to `input.projectId`. Viewer reads are allowed;
writes call `assertCanWrite(ctx.access)`.

- `list({ projectId })` — tree metadata only; no body/revision payloads.
- `recent({ projectId, limit = 6 })` — recent page metadata.
- `get({ projectId, documentId })` — current title/body/version/editor metadata
  and valid ticket reference data.
- `authoringContext({ projectId })` — project members plus lightweight active
  ticket reference items. Do not fetch the full `board.get` payload for Docs.
- `create({ projectId, parentId?, title })` — validate parent, place at sibling
  end, create revision 1, return page id/version.
- `update({ projectId, documentId, expectedVersion, title, body })` — sanitize;
  derive `searchText`; compare-and-swap version; append revision; replace valid
  task links in one transaction. Return `CONFLICT` when the head moved.
- `move({ projectId, documentId, parentId, beforeId?, afterId? })` — reject
  cross-project IDs and cycles, calculate fractional position server-side.
- `history({ projectId, documentId, cursor? })` — newest-first revision metadata,
  paginated.
- `revision({ projectId, documentId, version })` — body/title for preview.
- `restore({ projectId, documentId, version, expectedVersion })` — restore by
  creating a new head revision and rebuilding its derived task links.
- `linkedToTask({ boardId, taskId })` — `boardProcedure`; verify task/board,
  return page id/title/project slug for the task detail sheet.
- `search({ query, projectId?, limit = 8 })` — `protectedProcedure`; enforce
  ownership/membership like `task.search`, exclude archived projects, match
  title plus `searchText`, return project metadata for routing.

Move the generic rich-text sanitizer from the MCP-specific namespace to
`apps/web/src/server/rich-text/sanitize.ts`. Keep
`apps/web/src/server/mcp/sanitize.ts` as a compatibility re-export or update all
existing imports in the same change. Add helper functions that:

- sanitize allowed HTML;
- derive normalized plain text;
- extract unique `data-type="ticket"` / `data-id` task IDs;
- ignore malformed nodes and validate extracted IDs against tasks on the
  project's board before writing `documentTaskLink`.

## Current repo seams to reuse

- `schema.ts:219-223` — project roles are already `owner`, `editor`, `viewer`.
- `schema.ts:251-299` — project and membership are the permission boundary.
- `schema.ts:326-337` — one board belongs to one project, so ticket links can be
  verified without a new workspace concept.
- `trpc.ts` — `projectProcedure`, `boardProcedure`, and `assertCanWrite` encode
  the ACL conventions; do not duplicate role checks in the client.
- `position.ts` — fractional positioning helpers are mandatory for siblings.
- `rich-text-editor.tsx:30-36` — editor and read renderer share prose styling.
- `rich-text-editor.tsx:101-120` — StarterKit plus member/ticket extensions are
  already the content format.
- `rich-text-mention.tsx:37-46, 504-557` — ticket nodes persist stable task IDs
  and readable ticket labels.
- `task.ts:399-441` — cross-project task search is the authorization/query shape
  for document search.
- `project/[slug]/layout.tsx:24-31` — the project layout currently prefetches the
  full board on every child route. Move `board.get` prefetch to the Board page so
  opening Docs does not ship every task description.
- `task-detail-sheet.tsx:292-329` — place the Docs backlink section between the
  description and checklist so context precedes execution detail.
- `server/mcp/sanitize.ts` — existing server allowlist must remain the canonical
  stored-rich-text boundary.

## Files in scope

Expected modifications:

- `apps/web/src/server/db/schema.ts`
- generated files under `apps/web/drizzle/`
- `apps/web/src/server/api/root.ts`
- `apps/web/src/server/api/routers/document.ts` (new)
- `apps/web/src/server/rich-text/sanitize.ts` (new)
- `apps/web/src/server/documents/content.ts` (new pure extraction helpers)
- `apps/web/src/server/mcp/sanitize.ts` and/or its consumers
- `apps/web/src/components/ui/rich-text-editor.tsx`
- `apps/web/src/components/ui/rich-text-mention.tsx`
- `apps/web/src/components/command/command-palette.tsx`
- `apps/web/src/app/app/p/[slug]/layout.tsx`
- `apps/web/src/app/app/p/[slug]/page.tsx`
- `apps/web/src/app/app/p/[slug]/_components/project-section-nav.tsx` (new)
- `apps/web/src/app/app/p/[slug]/_components/task-detail-sheet.tsx`
- new route/components under `apps/web/src/app/app/p/[slug]/docs/`
- focused unit tests for content extraction, hierarchy cycle detection, and
  version conflict helpers once Plan 001 is present
- `plans/README.md` status only

Out of scope even if adjacent:

- `apps/focus`
- public board routes and board share schema
- project roles or new permission tables
- notification and digest schema/routers
- task attachment schema/router and R2 object deletion
- AI prompt code
- MCP tool registration (follow-up slice)

## Implementation sequence

### Step 0: Validate the workflow before schema

Produce the low-fidelity workflow described under “Product assumptions to
validate.” Record the five task completion results in the issue/PR description.

**Gate**: at least 4/5 participants complete each core task, or the product owner
explicitly accepts the observed failure and revised design.

### Step 1: Add persistence and pure helpers

Add the three tables/relations/indexes, generate (do not hand-write) the Drizzle
migration, and add pure helper tests for HTML-to-text, ticket extraction,
duplicate removal, invalid markup, and hierarchy cycle detection.

**Verify**:

- `pnpm db:generate` exits 0 and creates one new migration.
- `pnpm --filter web test -- src/server/documents` passes when Plan 001 exists.
- Inspect the generated SQL: no existing table/column is dropped.

Do not run `db:push` or `db:migrate` against a real database without explicit
operator approval.

### Step 2: Implement the document router

Implement read queries first, then create/update/move/history/restore/search.
Keep every multi-write mutation transactional. Add small private helpers to
assert document/project and parent/project identity. The update statement must
include both `documentId` and `expectedVersion` in its predicate; zero returned
rows means `CONFLICT`.

**Verify**:

- If a database test harness exists by then, router integration tests cover
  viewer reads/write rejection, cross-project IDs, stale versions, revisions,
  and task-link replacement. Otherwise execute and record these as manual API
  checks; do not pretend implementation mocks verify database transactions.
- `pnpm --filter web typecheck` exits 0.

### Step 3: Add Board / Docs project navigation and route shell

Add `ProjectSectionNav` to the project header. Active state derives from the
pathname. Move only the full `api.board.get.prefetch` call from project layout to
the board page; keep shared project/member data where both surfaces need it.
Build Docs home, tree sidebar, mobile drawer, recent list, loading states, and
not-found behavior using server prefetch plus client interaction components.

**Verify**:

- Board, Docs, and Settings links retain the project slug.
- Opening a Docs URL does not call `board.get`.
- Viewer role sees Docs but no create/edit/move controls.
- `pnpm --filter web typecheck` exits 0.

### Step 4: Build focused reader/editor/history flows

Reuse the rich-text schema, but give Docs a long-form variant with a persistent
compact toolbar. Keep task/comment editor rendering unchanged. Implement local
draft state, dirty navigation guard, save/cancel shortcuts, conflict handling,
revision preview, and restore-as-new-version.

On `CONFLICT`, preserve the unsaved local title/body in memory, show who changed
the latest version, and offer **Copy my draft** and **Reload latest**. Do not
silently retry the stale write.

**Verify**:

- Existing task descriptions/comments still edit and render identically.
- Saving once increments version once and creates one history row.
- Cancel never mutates server state.
- Restore creates a newer version and keeps the restored source revision.
- Keyboard focus and visible focus rings work for tree, editor, menus, and sheet.

### Step 5: Connect Docs and tasks

On save, rebuild normalized document-to-task links from valid ticket nodes.
Extend the ticket mention runtime item with a route/href fallback so a read-only
ticket chip in Docs opens the existing task route. Add `LinkedDocs` to the task
detail sheet with title links. Do not add a special task-owned document type.

**Verify**:

- Referencing a ticket in a page makes the page appear in that task immediately
  after save.
- Removing the last mention removes the backlink after save.
- Forged task IDs from another project are ignored/rejected server-side.
- Clicking a ticket from Docs lands on the correct board with its task sheet open.

### Step 6: Add findability

Add local Docs search to the sidebar and cross-project document results to the
command palette. Search title and server-derived text; return snippets only if
they can be generated without sending full bodies to the client. Add palette
action **New page in current project** when a project Docs context is active.

**Verify**:

- A viewer finds only documents from projects they can access.
- Archived projects never appear.
- Selecting a result routes by stable document ID.
- Empty, one-character, and wildcard-containing queries are handled safely.

### Step 7: Hardening and handoff

Run format check, typecheck, focused tests, and lint with the repo's documented
pre-existing lint exceptions. Review keyboard behavior at 320px, 768px, and
desktop width. Confirm no full document bodies are returned by tree/recent/search
queries. Add a short architecture note to `AGENTS.md` only after implementation
exists, describing the new document router, routes, permissions, and link model.

**Verify**:

- `pnpm --filter web test` passes (after Plan 001).
- `pnpm --filter web typecheck` exits 0.
- `pnpm --filter web format` exits 0.
- `git diff --check` exits 0.
- No production/development build or application server is run unless the user
  explicitly requests it.

## Test plan

Pure unit tests:

- sanitize allowed formatting and remove scripts/event handlers/unsafe schemes;
- extract ticket IDs from canonical spans, deduplicate, and ignore malformed IDs;
- derive human-readable normalized search text;
- reject self-parent and ancestor cycles;
- compute correct sibling position at root/end/between;
- compare expected/current versions.

Database/router tests (if the repo gains a test DB harness; otherwise document
these as required manual API checks and do not fake them with implementation
mocks):

- owner/editor/viewer authorization matrix;
- cross-project document, parent, task, revision IDs;
- atomic create + revision 1;
- atomic update + revision + link replacement;
- two writers saving the same version, where exactly one succeeds;
- restore produces a new head;
- search ownership/membership isolation.

Manual usability/accessibility checks:

- empty project → first page → child → move;
- reader/editor/history happy path;
- stale edit conflict without draft loss;
- task mention → backlink → task chip round-trip;
- command palette search across two accessible and one inaccessible project;
- keyboard-only operation and screen-reader labels for tree disclosures.

## Done criteria

- [ ] Project header exposes Board and Docs with correct active state.
- [ ] Viewer can read/search; editor and owner can create/edit/move/restore.
- [ ] No page-specific ACL or separate space concept was added.
- [ ] Tree and search endpoints never return full bodies.
- [ ] Every saved version is recoverable and stale saves cannot overwrite it.
- [ ] Ticket references create server-derived backlinks visible in task detail.
- [ ] A ticket opened from Docs reaches the existing task sheet.
- [ ] Global command palette searches accessible Docs.
- [ ] Focused tests, typecheck, format check, and `git diff --check` pass.
- [ ] No source files outside this plan's scope changed.

## STOP conditions

Stop and report instead of improvising if:

- unrelated uncommitted schema/board changes are still present when execution
  starts;
- Plan 001 has not landed and no test framework exists—either execute Plan 001
  first or get explicit approval for a narrower verification strategy;
- product validation shows a global/team knowledge space is the primary need;
- implementing self-references requires changing project deletion semantics;
- document writes cannot be made transactional with the configured Drizzle/pg
  stack;
- ticket mention navigation would require breaking the existing board event path;
- the implementation starts requiring per-page ACLs, CRDT, or a search service
  to satisfy the MVP;
- a verification gate fails twice after a reasonable correction.

## Rollout and follow-ups

Release to a staging/pilot cohort before general availability; do not add a
permanent feature flag solely for rollout. Evaluate after two weeks:

- projects with at least one page;
- weekly page readers vs. editors;
- page opens originating from task backlinks;
- successful search selection rate;
- conflict frequency;
- median pages per active project.

Only after the core loop is used, consider these slices in order:

1. **Page-to-page links and backlinks** using a `[[page]]` mention node and a
   derived join table. This makes it a real wiki without adding databases.
2. **Subtree archive/restore** with explicit behavior for descendants.
3. **MCP tools**: `list_documents`, `search_documents`, `get_document`,
   `create_document`, `update_document(expectedVersion)`. Reuse tRPC, scopes,
   HTML sanitization, ACLs, and revision conflicts.
4. **Attachments** by generalizing the R2 model to a typed parent rather than
   copying the task attachment router.
5. **Curated AI context**: let an owner nominate a small set of pages for task
   drafting/agent guidance. Never ingest the whole tree by default.
6. **Realtime/coediting** only if conflicts are frequent enough to justify a
   project event stream or CRDT.

Inline comments, templates, notifications, and public publishing stay behind
those follow-ups; they are not prerequisites for useful project knowledge.
