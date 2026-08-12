# Plan 002: Close IDOR gaps — verify child objects belong to the caller's board before mutating

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29b619a..HEAD -- apps/web/src/server/api/routers/column.ts apps/web/src/server/api/routers/checklist.ts apps/web/src/server/api/routers/attachment.ts`
> If any of these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (every change only *adds* an ownership check; it cannot break a legitimate caller)
- **Depends on**: none (Plan 001 is recommended first so you can add tests, but not required)
- **Category**: security
- **Planned at**: commit `29b619a`, 2026-06-18

## Why this matters

`boardProcedure` verifies that the **caller** is a member of `input.boardId`.
It does **not** verify that a child-object ID passed in the same request
(`columnId`, checklist `itemId`, `taskId`) actually belongs to that board.
Several mutating handlers update/delete/insert using only the child ID's
primary key, with no board scope in the `WHERE` clause.

Concretely: a user who is a legitimate editor on **their own** board can pass
their own `boardId` (which passes the membership check) together with a
**column / checklist-item / task ID from a different board they have no access
to**, and the mutation will hit that other board's row. This is a cross-tenant
horizontal-privilege-escalation IDOR: rename or reorder another project's
columns, toggle/rename/delete another project's checklist items, or attach a
file record to another project's task.

The fix is to add the same ownership check that **already exists elsewhere in
these very files** — this plan is pattern-matching, not new design.

## Current state

The repo already does this correctly in three places — these are your
**exemplars**:

1. `column.delete` and `column.setSort` (`column.ts`) pre-fetch the column and
   assert it belongs to the board:
   ```ts
   const existing = await ctx.db
     .select({ id: boardColumn.id, boardId: boardColumn.boardId })
     .from(boardColumn)
     .where(eq(boardColumn.id, input.columnId))
     .limit(1);
   const hit = existing[0];
   if (!hit || hit.boardId !== input.boardId) {
     throw new TRPCError({ code: "NOT_FOUND" });
   }
   ```
2. `checklist.add` and `checklist.list` (`checklist.ts`) call the in-file helper
   `assertTaskOnBoard(ctx.db, input.taskId, input.boardId)` (defined at the top
   of `checklist.ts`, lines 16–29):
   ```ts
   async function assertTaskOnBoard(db: typeof Db, taskId: string, boardId: string) {
     const row = await db
       .select({ boardId: task.boardId })
       .from(task)
       .where(eq(task.id, taskId))
       .limit(1);
     if (!row[0] || row[0].boardId !== boardId) {
       throw new TRPCError({ code: "NOT_FOUND" });
     }
   }
   ```
3. Every `task.ts` mutation (`update`, `delete`, `move`, `archive`) scopes the
   `WHERE` clause: `where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)))`.

The **vulnerable** handlers that skip the check:

- `src/server/api/routers/column.ts`
  - `rename` (lines 40–57): `update(boardColumn).set({ name }).where(eq(boardColumn.id, input.columnId))` — **no boardId check**.
  - `reorder` (lines 94–112): `update(boardColumn).set({ position }).where(eq(boardColumn.id, input.columnId))` — **no boardId check**.
- `src/server/api/routers/checklist.ts`
  - `toggle` (lines 73–128): updates `WHERE eq(checklistItem.id, input.itemId)` with no board check; it *does* later fetch `taskId` for the notification, but only **after** the write and without asserting the board.
  - `rename` (lines 130–144): `update(checklistItem).set({ text }).where(eq(checklistItem.id, input.itemId))` — **no board check**.
  - `remove` (lines 146–154): `delete(checklistItem).where(eq(checklistItem.id, input.itemId))` — **no board check**.
- `src/server/api/routers/attachment.ts`
  - `create` (lines 81–109): inserts a `taskAttachment` row with the client-supplied `input.taskId` and **no check** that the task belongs to `input.boardId`. Compare `attachment.createUploadUrl` (lines 51–79) and `attachment.list`/`remove`, which all do check.

`task.ts` is **not** vulnerable and is **out of scope** — it already does this
correctly and is the reference pattern.

## Commands you will need

| Purpose           | Command                              | Expected on success |
|-------------------|--------------------------------------|---------------------|
| Install deps      | `pnpm install`                       | exit 0              |
| Typecheck (web)   | `pnpm --filter web typecheck`        | exit 0, no errors   |
| Run tests (web)   | `pnpm --filter web test`             | all pass (if Plan 001 landed; otherwise "no test script" — skip) |
| Grep checks       | (given per step)                     | as stated           |

> Use `pnpm --filter web typecheck` as the hard gate. `pnpm lint` has a
> pre-existing unrelated error — do not try to fix it here.

## Scope

**In scope** (the only files you should modify):
- `apps/web/src/server/api/routers/column.ts`
- `apps/web/src/server/api/routers/checklist.ts`
- `apps/web/src/server/api/routers/attachment.ts`
- `plans/README.md` (status update)

**Out of scope** (do NOT touch):
- `apps/web/src/server/api/routers/task.ts` — already correct; the reference pattern.
- Extracting `assertTaskOnBoard` into a shared module — that is the duplication
  cleanup in a *separate* plan. Here, keep using the per-file helper that
  already exists in `checklist.ts`, and the inline pre-fetch pattern in `column.ts`.
- The realtime `bus.emitBoard(...)` calls — leave them exactly as they are.
- Changing any input schema, response shape, or error code other than adding the
  `NOT_FOUND` guard.

## Git workflow

- Branch: `advisor/002-idor-ownership-checks`
- Conventional commit, e.g. `fix(security): verify child objects belong to caller's board (IDOR)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Guard `column.rename` and `column.reorder`

In `column.ts`, add the same pre-fetch-and-assert used by `column.delete`/`setSort`
**before** the `update(...)` call in both `rename` and `reorder`. The file
already imports `TRPCError`, `eq`, and `boardColumn`. Target shape for `rename`:

```ts
rename: boardProcedure
  .input(z.object({ columnId: z.string().min(1), name: z.string().min(1).max(80) }))
  .mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.access);
    const existing = await ctx.db
      .select({ id: boardColumn.id, boardId: boardColumn.boardId })
      .from(boardColumn)
      .where(eq(boardColumn.id, input.columnId))
      .limit(1);
    const hit = existing[0];
    if (!hit || hit.boardId !== input.boardId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    await ctx.db
      .update(boardColumn)
      .set({ name: input.name })
      .where(eq(boardColumn.id, input.columnId));
    bus.emitBoard(input.boardId, { scope: "column", ids: [input.columnId] });
  }),
```
Apply the identical guard (the `existing`/`hit` block) to `reorder`, immediately
after `assertCanWrite(ctx.access);` and before its `update(...)`.

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `grep -n "hit.boardId !== input.boardId" apps/web/src/server/api/routers/column.ts` → **4** matches (the two existing in `setSort`/`delete` plus the two you just added).

### Step 2: Guard `checklist.toggle`, `checklist.rename`, `checklist.remove`

In `checklist.ts`, call the existing `assertTaskOnBoard` helper before each
mutation. These handlers receive `itemId`, not `taskId`, so first resolve the
item's `taskId`, then assert, then mutate.

For `toggle`, restructure so the `taskId` fetch happens **before** the update
(it currently happens after). Target shape:
```ts
toggle: boardProcedure
  .input(z.object({ itemId: z.string().min(1), done: z.boolean() }))
  .mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.access);

    const itemRow = await ctx.db
      .select({ taskId: checklistItem.taskId })
      .from(checklistItem)
      .where(eq(checklistItem.id, input.itemId))
      .limit(1);
    const taskId = itemRow[0]?.taskId;
    if (!taskId) throw new TRPCError({ code: "NOT_FOUND" });
    await assertTaskOnBoard(ctx.db, taskId, input.boardId);

    await ctx.db
      .update(checklistItem)
      .set({ done: input.done })
      .where(eq(checklistItem.id, input.itemId));
    bus.emitBoard(input.boardId, { scope: "checklist", ids: [input.itemId] });

    if (!input.done) return;

    // taskId is already resolved above — reuse it (delete the old re-fetch).
    const items = await ctx.db
      .select({ done: checklistItem.done })
      .from(checklistItem)
      .where(eq(checklistItem.taskId, taskId));
    // ... rest of the existing "all done" notification block, unchanged ...
  }),
```
> Note: the existing `toggle` body re-fetches `taskId` after the update (the
> `itemRow`/`taskId` block at lines 85–91). Remove that duplicate fetch — you
> now resolve `taskId` at the top. The downstream `items`/`taskRows`/notification
> logic stays exactly as-is.

For `rename` and `remove`, add the resolve-and-assert preamble before the
mutation:
```ts
const itemRow = await ctx.db
  .select({ taskId: checklistItem.taskId })
  .from(checklistItem)
  .where(eq(checklistItem.id, input.itemId))
  .limit(1);
const taskId = itemRow[0]?.taskId;
if (!taskId) throw new TRPCError({ code: "NOT_FOUND" });
await assertTaskOnBoard(ctx.db, taskId, input.boardId);
```
`checklist.ts` already imports `TRPCError`, `eq`, `checklistItem`, and defines
`assertTaskOnBoard` — no new imports needed.

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `grep -c "assertTaskOnBoard(ctx.db" apps/web/src/server/api/routers/checklist.ts` → **5** (the existing `list` + `add`, plus `toggle`, `rename`, `remove`).

### Step 3: Guard `attachment.create`

In `attachment.ts`, add the task-ownership check used by `createUploadUrl`
before the insert in `create`. The file already imports `TRPCError`, `eq`,
`task`. Target shape:
```ts
create: boardProcedure
  .input(z.object({ /* unchanged */ }))
  .mutation(async ({ ctx, input }) => {
    assertCanWrite(ctx.access);
    const t = await ctx.db
      .select({ boardId: task.boardId })
      .from(task)
      .where(eq(task.id, input.taskId))
      .limit(1);
    if (!t[0] || t[0].boardId !== input.boardId) {
      throw new TRPCError({ code: "NOT_FOUND" });
    }
    const [row] = await ctx.db
      .insert(taskAttachment)
      .values({ /* unchanged */ })
      .returning();
    bus.emitBoard(input.boardId, { scope: "attachment", ids: [input.taskId] });
    return row;
  }),
```

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `grep -c "t\[0\].boardId !== input.boardId" apps/web/src/server/api/routers/attachment.ts` → **3** (`list`, `createUploadUrl`, and the new `create`).

### Step 4: Full verification

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- If Plan 001 has landed: `pnpm --filter web test` → all pass (no test here
  exercises these routers, but nothing should regress).
- `git status --short` → only the three router files and `plans/README.md` changed.

## Test plan

There is no test database in this repo, so these IDOR fixes cannot be covered by
an automated integration test yet (that infrastructure is a separate plan). The
verification gates for this plan are therefore:

- `pnpm --filter web typecheck` exits 0.
- The three grep assertions in Steps 1–3 each return the stated count, proving
  every previously-unguarded handler now performs an ownership check.
- Manual reasoning checklist (confirm by reading the diff): for each of
  `column.rename`, `column.reorder`, `checklist.toggle`, `checklist.rename`,
  `checklist.remove`, `attachment.create`, there is now a check that throws
  `NOT_FOUND` when the child object's `boardId` ≠ `input.boardId`, **before** the
  write.

When a test-database harness lands later, add `*.router.test.ts` cases that call
each handler with a mismatched `boardId`/child-ID pair and assert `NOT_FOUND`.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `grep -c "hit.boardId !== input.boardId" apps/web/src/server/api/routers/column.ts` → 4.
- [ ] `grep -c "assertTaskOnBoard(ctx.db" apps/web/src/server/api/routers/checklist.ts` → 5.
- [ ] `grep -c "boardId !== input.boardId" apps/web/src/server/api/routers/attachment.ts` → 3.
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Any vulnerable handler no longer matches the "Current state" excerpt (the code
  drifted — someone may have already added a check; verify before duplicating).
- Adding a guard causes a typecheck error you cannot resolve by mirroring the
  exemplar (e.g. `assertTaskOnBoard` signature changed).
- You find a mutating handler in these three files that takes a child-object ID
  and is *still* unguarded after your changes — report it rather than guessing
  at a fix.

## Maintenance notes

- **Related follow-ups deliberately deferred** (do not do them here; record for
  the maintainer):
  1. `task.create` / `task.createMany` read positions by `eq(task.columnId, input.columnId)`
     without verifying the column belongs to `input.boardId`. This is a lesser
     data-integrity issue (a task is created with the *caller's* `boardId` but a
     foreign `columnId`), not a write to a victim's board. Worth a small guard
     later (validate `columnId` ∈ board).
  2. `attachment.create` trusts the client-supplied `key`. Once the taskId→board
     check here lands, the residual risk (registering an arbitrary R2 key) is
     reduced, but a proper fix is a short-lived server-side "upload intent"
     record keyed in `createUploadUrl` and validated in `create`. Separate plan.
- A reviewer should scrutinize that the ownership check runs **before** any write
  and before the `bus.emitBoard` call, and that the `toggle` refactor did not
  drop the "all checklist items done" notification behavior.
- These checks add one extra `SELECT ... LIMIT 1` per mutation. That is the same
  cost the secure handlers already pay; it is acceptable.
</content>
