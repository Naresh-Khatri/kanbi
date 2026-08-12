# Plan 004: Wire `needsRebalance`/`rebalancePositions` so drag-ordering cannot silently collapse

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29b619a..HEAD -- apps/web/src/lib/position.ts apps/web/src/server/api/routers/column.ts apps/web/src/server/api/routers/task.ts`
> If any changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding. **Plan 002 also edits
> `column.reorder` and Plan 002/Plan 001 may have landed first — that is
> expected**; preserve any ownership checks already present. A change to
> `positionBetween`/`needsRebalance`/`rebalancePositions` themselves is a STOP
> condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (introduces a multi-row UPDATE inside a transaction on the reorder hot path)
- **Depends on**: `plans/001-test-baseline-vitest.md` (the `position.ts` unit
  tests must exist before changing how these functions are used). **Recommended
  to run after `plans/002`** since both edit `column.reorder`.
- **Category**: bug (correctness)
- **Planned at**: commit `29b619a`, 2026-06-18

## Why this matters

Ordering uses fractional positions: to drop an item between two neighbors, the
server stores `positionBetween(before, after) = (before + after) / 2`. Repeated
drops into the **same gap** halve it each time. `src/lib/position.ts` ships two
functions designed to prevent the gap from collapsing to floating-point
equality — `needsRebalance(before, after)` and `rebalancePositions(count)` — but
**neither is called anywhere** (`grep` finds only their definitions). So nothing
ever rebalances. After enough reorders into one gap, two items get
indistinguishable positions and their relative order becomes undefined; the user
sees a drag "stick" or cards swap back after the next refetch.

The fix: detect a collapsing gap at the reorder site and, when detected,
re-space the affected column's items evenly. Crucially, `needsRebalance` fires
at `gap < 0.0005` — *long before* floating-point ties occur (~21 bisections vs
~50) — so at the trigger point the newly written position is still **strictly
between** its neighbors and correctly ordered. That invariant (verified by the
unit test added in Plan 001) is what makes the "write, then rebalance" approach
below correct.

## Current state

- `src/lib/position.ts` — `needsRebalance(before: number, after: number): boolean`
  returns `after - before < POSITION_EPSILON` (`POSITION_EPSILON = 0.0005`);
  `rebalancePositions(count: number): number[]` returns
  `[STEP, 2*STEP, ..., count*STEP]` (`POSITION_STEP = 1024`). Both exported,
  **zero callers** (confirmed via `grep -rn "needsRebalance\|rebalancePositions" apps/web/src`).

- `column.reorder` (`column.ts`, lines 94–112) — current body:
  ```ts
  reorder: boardProcedure
    .input(z.object({
      columnId: z.string().min(1),
      before: z.number().nullable(),
      after: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertCanWrite(ctx.access);
      await ctx.db
        .update(boardColumn)
        .set({ position: positionBetween(input.before, input.after) })
        .where(eq(boardColumn.id, input.columnId));
      bus.emitBoard(input.boardId, { scope: "column", ids: [input.columnId] });
    }),
  ```
  Imports already present in `column.ts`: `asc, eq` from `drizzle-orm`;
  `positionAtEnd, positionBetween` from `@/lib/position`; `boardColumn`. You will
  add `needsRebalance, rebalancePositions` to the position import.
  > If Plan 002 landed, `reorder` now also has an ownership pre-fetch/assert
  > block — keep it; insert the rebalance logic after the `update(...)`.

- `task.move` (`task.ts`, lines 302–375) — already ownership-scoped. The
  relevant write is:
  ```ts
  await ctx.db
    .update(task)
    .set({
      columnId: input.toColumnId,
      position: positionBetween(input.before, input.after),
    })
    .where(and(eq(task.id, input.taskId), eq(task.boardId, input.boardId)));
  bus.emitBoard(input.boardId, { scope: "task", ids: [input.taskId] });
  ```
  Task positions are **per-column** (schema index `task_column_position_idx` on
  `(columnId, position)`). Imports already present in `task.ts`: `and, asc, eq`
  (verify `asc` is imported — add it if not), `POSITION_STEP, positionAtEnd,
  positionBetween` from `@/lib/position`, `task, boardColumn`. You will add
  `needsRebalance, rebalancePositions` to the position import.

## Commands you will need

| Purpose         | Command                          | Expected on success |
|-----------------|----------------------------------|---------------------|
| Install deps    | `pnpm install`                   | exit 0              |
| Typecheck (web) | `pnpm --filter web typecheck`    | exit 0, no errors   |
| Tests (web)     | `pnpm --filter web test`         | all pass (Plan 001 must have landed) |

## Scope

**In scope** (the only files you should modify):
- `apps/web/src/server/api/routers/column.ts` (add rebalance to `reorder`)
- `apps/web/src/server/api/routers/task.ts` (add rebalance to `move`)
- `apps/web/src/lib/position.test.ts` (extend — add the rebalance-spacing assertions if not already present from Plan 001)
- `plans/README.md` (status update)

**Out of scope** (do NOT touch):
- The functions in `position.ts` themselves — do not change their signatures or
  bodies; this plan only *calls* them.
- `column.create`, `task.create`, `task.createMany`, `checklist` positions — they
  use `positionAtEnd` (append), which does not collapse gaps. Leave them.
- The client-side optimistic update logic in `board-view.tsx` — the rebalance is
  server-authoritative; the client will pick up new positions on the next
  `board.get` invalidation, which already fires.

## Git workflow

- Branch: `advisor/004-position-rebalance`
- Conventional commit, e.g. `fix(board): rebalance fractional positions when gaps collapse`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rebalance in `column.reorder`

In `column.ts`, extend the `@/lib/position` import to include `needsRebalance`
and `rebalancePositions`. After the existing `update(...)` that sets the new
position (and after the `bus.emitBoard` is fine, or before — order does not
matter for correctness, but do it before the emit so clients refetch the
rebalanced state), add:

```ts
if (
  input.before != null &&
  input.after != null &&
  needsRebalance(input.before, input.after)
) {
  await ctx.db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: boardColumn.id })
      .from(boardColumn)
      .where(eq(boardColumn.boardId, input.boardId))
      .orderBy(asc(boardColumn.position));
    const positions = rebalancePositions(rows.length);
    for (let i = 0; i < rows.length; i++) {
      await tx
        .update(boardColumn)
        .set({ position: positions[i]! })
        .where(eq(boardColumn.id, rows[i]!.id));
    }
  });
}
```
Place this so the moved column's new (still-distinct) position is already
written before the `select ... order by position` runs — i.e. **after** the
existing `update`. Keep the existing `bus.emitBoard(...)` as the last line.

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `grep -n "rebalancePositions" apps/web/src/server/api/routers/column.ts` → ≥1 match.

### Step 2: Rebalance in `task.move`

In `task.ts`, extend the `@/lib/position` import to include `needsRebalance` and
`rebalancePositions` (and ensure `asc` is imported from `drizzle-orm`). After the
existing `update(task)...` write and its `bus.emitBoard`, add a per-column
rebalance scoped to the **destination** column:

```ts
if (
  input.before != null &&
  input.after != null &&
  needsRebalance(input.before, input.after)
) {
  await ctx.db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: task.id })
      .from(task)
      .where(
        and(eq(task.columnId, input.toColumnId), eq(task.boardId, input.boardId)),
      )
      .orderBy(asc(task.position));
    const positions = rebalancePositions(rows.length);
    for (let i = 0; i < rows.length; i++) {
      await tx
        .update(task)
        .set({ position: positions[i]! })
        .where(eq(task.id, rows[i]!.id));
    }
  });
  bus.emitBoard(input.boardId, { scope: "task", ids: [] });
}
```
The extra `bus.emitBoard(..., { ids: [] })` signals a list-level change so all
clients refetch the rebalanced column (the per-id emit already fired for the
moved task).

> Keep the existing `task.moved` activity record and the `task.moved_to_done`
> notification block exactly as they are — insert the rebalance block without
> disturbing them.

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `grep -n "rebalancePositions" apps/web/src/server/api/routers/task.ts` → ≥1 match.

### Step 3: Confirm/extend the position unit tests

Plan 001 already added `src/lib/position.test.ts` with a `needsRebalance`
boundary test asserting the "midpoint still strictly between bounds at the
trigger point" invariant, and a `rebalancePositions` spacing test. Confirm those
exist; if Plan 001 was executed differently and they are missing, add:
```ts
it("rebalanced positions are evenly spaced and strictly increasing", () => {
  const ps = rebalancePositions(5);
  expect(ps).toEqual([1024, 2048, 3072, 4096, 5120]);
});
it("needsRebalance triggers while positionBetween is still strictly between", () => {
  const before = 1000, after = before + POSITION_EPSILON / 2;
  expect(needsRebalance(before, after)).toBe(true);
  const mid = positionBetween(before, after);
  expect(mid > before && mid < after).toBe(true);
});
```

**Verify**: `pnpm --filter web test` → all pass.

### Step 4: Full verification

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `pnpm --filter web test` → all pass.
- `git status --short` → only `column.ts`, `task.ts`, `position.test.ts`, and
  `plans/README.md` changed.

## Test plan

- Unit (in `position.test.ts`, mostly from Plan 001): `rebalancePositions`
  produces evenly-spaced strictly-increasing values; `needsRebalance` fires
  before `positionBetween` ties (the correctness invariant for this plan).
- The router-level rebalance behavior cannot be integration-tested without a
  test database (separate plan). Verification here is typecheck + the unit tests
  + reading the diff to confirm: the rebalance runs inside a transaction, reads
  ordered by position **after** the new position is written, and is scoped to the
  correct collection (whole board for columns; destination column for tasks).

## Done criteria

ALL must hold:

- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `pnpm --filter web test` exits 0; the `position.test.ts` rebalance/boundary
      assertions pass.
- [ ] `grep -rn "rebalancePositions(" apps/web/src/server` → matches in both
      `column.ts` and `task.ts`.
- [ ] The rebalance in each site runs inside `ctx.db.transaction(...)` and only
      when both `before` and `after` are non-null and `needsRebalance` is true.
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- Any function in `position.ts` (`positionBetween`, `needsRebalance`,
  `rebalancePositions`, `POSITION_EPSILON`, `POSITION_STEP`) differs from the
  "Current state" excerpt — the math changed and this plan's correctness
  argument may no longer hold.
- `task.ts` does not import `asc` and adding it causes an unexpected conflict.
- Plan 001 has **not** landed (no `position.test.ts`, no `test` script) — the
  dependency is unmet; stop and report rather than changing callers untested.
- You determine task positions are **not** per-column (e.g. the schema index or
  `board.get` ordering implies board-global task positions) — the task rebalance
  scope would be wrong; report before proceeding.

## Maintenance notes

- The rebalance is O(n) UPDATEs in a transaction, triggered rarely (only when a
  gap has been bisected ~21 times). On pathological boards with thousands of
  tasks in one column it is still a single bounded transaction; if that ever
  becomes a concern, switch the per-row loop to a single `UPDATE ... FROM
  (VALUES ...)` statement.
- A reviewer should confirm the ordered read happens *after* the moved item's new
  position is committed within the same logical operation, so the rebalanced
  order matches the user's intended drop.
- If task positions are ever made board-global (not per-column), the `task.move`
  rebalance scope (`eq(task.columnId, input.toColumnId)`) must be revisited.
- Related but separate: `column.reorder`/`task.move` still read-then-write
  without wrapping the *initial* position write in a transaction (a concurrent
  reorder race). That is a distinct concurrency finding, not addressed here.
</content>
