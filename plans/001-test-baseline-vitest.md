# Plan 001: Establish a Vitest verification baseline with first unit tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29b619a..HEAD -- apps/web/package.json apps/web/turbo.json apps/web/src/lib/position.ts apps/web/src/server/api/permissions.ts`
> (Note: `turbo.json` lives at the repo root, not under `apps/web` — adjust the
> path if the diff command reports it missing.) If any of these files changed
> since this plan was written, compare the "Current state" excerpts against the
> live code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S (tooling) + S (these tests)
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `29b619a`, 2026-06-18

## Why this matters

The repo has **no test suite at all** — `AGENTS.md` and `README.md` both say so.
The only automated signal today is `pnpm typecheck` and `pnpm lint`. The
highest-risk logic in the codebase is *pure and trivially testable*: the
fractional-position arithmetic in `src/lib/position.ts` governs every
drag-and-drop reorder, and the role ladder in `src/server/api/permissions.ts`
governs every authorization decision. A silent bug in either is a
data-corruption or security incident with no test to catch it.

This plan stands up Vitest and writes the first two test files against that
pure logic. It is a prerequisite for **Plan 004** (which changes
`position.ts`'s callers and must not do so blind) and the template for all
future tests.

## Current state

- `apps/web/package.json` — the web app manifest. Its `scripts` block today is:
  ```json
  "scripts": {
    "build": "next build",
    "format": "prettier --check .",
    "format:write": "prettier --write .",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio",
    "dev": "next dev --turbo --port 3333",
    "preview": "next build && next start",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  }
  ```
  There is **no** `test` script and **no** vitest/jest in `devDependencies`.
  The package is ESM (`"type": "module"`).

- `apps/web/tsconfig.json` — defines the path alias `"@/*": ["./src/*"]`, has
  `"strict": true` and `"noUncheckedIndexedAccess": true`. Tests must satisfy
  both (e.g. index access on arrays yields `T | undefined`).

- `turbo.json` (at the **repo root**, `/home/naresh/Desktop/projects-next/kanbi/turbo.json`)
  — its `tasks` object contains `build`, `dev`, `lint`, `typecheck`, `format`,
  `format:write`. The `lint` task is `"lint": { "dependsOn": ["^lint"] }` — copy
  that shape for the new `test` task.

- `src/lib/position.ts` — **pure functions, zero imports**. Full current content:
  ```ts
  export const POSITION_STEP = 1024;
  export const POSITION_EPSILON = 0.0005;

  export function positionAtEnd(items: readonly { position: number }[]): number {
    if (items.length === 0) return POSITION_STEP;
    const last = items[items.length - 1]!;
    return last.position + POSITION_STEP;
  }

  export function positionAtStart(items: readonly { position: number }[]): number {
    if (items.length === 0) return POSITION_STEP;
    return items[0]!.position / 2;
  }

  export function positionBetween(
    before: number | null | undefined,
    after: number | null | undefined,
  ): number {
    if (before == null && after == null) return POSITION_STEP;
    if (before == null) return after! / 2;
    if (after == null) return before + POSITION_STEP;
    return (before + after) / 2;
  }

  export function needsRebalance(before: number, after: number): boolean {
    return after - before < POSITION_EPSILON;
  }

  export function rebalancePositions(count: number): number[] {
    return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
  }
  ```

- `src/server/api/permissions.ts` — exports the pure helper `roleCan` and the
  `ProjectRole` type. Relevant excerpt (lines 13–33):
  ```ts
  export type ProjectRole = (typeof projectRole.enumValues)[number];
  // ...
  const ROLE_RANK: Record<ProjectRole, number> = { viewer: 0, editor: 1, owner: 2 };
  export const roleCan = (role: ProjectRole, required: ProjectRole) =>
    ROLE_RANK[role] >= ROLE_RANK[required];
  ```
  The other exports (`resolveBoardAccess`, etc.) hit the database — **do not
  test those here**; this plan covers only the pure `roleCan`.

Conventions to match: TypeScript throughout, ESM imports, the `@/` alias for
`src` imports, two-space indentation, double-quoted strings (Prettier with the
tailwind plugin is the formatter).

## Commands you will need

| Purpose           | Command                                   | Expected on success      |
|-------------------|-------------------------------------------|--------------------------|
| Install deps      | `pnpm install`                            | exit 0                   |
| Run tests (web)   | `pnpm --filter web test`                  | all pass                 |
| Typecheck (web)   | `pnpm --filter web typecheck`             | exit 0, no errors        |
| Lint (web)        | `pnpm --filter web lint`                  | see note below           |

> **Lint note**: `pnpm lint` has a *pre-existing* error unrelated to this plan
> (an unescaped entity in an auth page). Do **not** try to fix it here. Use
> `pnpm --filter web typecheck` and `pnpm --filter web test` as your gates.

## Scope

**In scope** (the only files you should create or modify):
- `apps/web/package.json` (add `test` scripts + devDependencies)
- `apps/web/vitest.config.ts` (create)
- `apps/web/src/lib/position.test.ts` (create)
- `apps/web/src/server/api/permissions.test.ts` (create)
- `turbo.json` at the repo root (add a `test` task)
- `pnpm-lock.yaml` (will change as a result of `pnpm install` — expected)
- `plans/README.md` (status update)

**Out of scope** (do NOT touch):
- Any application source under `src/` other than creating the two `*.test.ts` files.
- `src/lib/position.ts` and `src/server/api/permissions.ts` themselves — this plan
  only *reads* them. (Plan 004 changes `position.ts`'s callers.)
- Any attempt to test database-backed functions (`resolveBoardAccess`,
  the routers) — there is no test database; that is a separate future plan.

## Git workflow

- Branch: `advisor/001-test-baseline`
- Commit style is conventional commits (see `git log`: `feat(...)`, `refactor(...)`,
  `docs(...)`). Use e.g. `test(web): add vitest baseline with position + role tests`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add Vitest to the web app

In `apps/web/package.json`, add to `devDependencies` (keep alphabetical-ish
ordering with the existing entries):
```json
"vitest": "^3.2.4"
```
And add two scripts to the `scripts` block:
```json
"test": "vitest run",
"test:watch": "vitest"
```
Then run `pnpm install`.

**Verify**: `pnpm install` → exit 0; `ls apps/web/node_modules/.bin/vitest` → file exists.

### Step 2: Create the Vitest config

Create `apps/web/vitest.config.ts` with the `@/` alias wired and env-validation
disabled inside the test worker (so importing any module that transitively
touches `src/env.js` cannot fail for lack of runtime env vars):
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: { SKIP_ENV_VALIDATION: "1" },
  },
});
```

**Verify**: `pnpm --filter web exec vitest run --reporter=dot` → runs and reports
"no test files found" (or runs zero tests) **without** a config or env error.

### Step 3: Write `src/lib/position.test.ts`

Create `apps/web/src/lib/position.test.ts`. Cover every exported function,
including the precision-collapse boundary that Plan 004 relies on:
```ts
import { describe, expect, it } from "vitest";

import {
  POSITION_EPSILON,
  POSITION_STEP,
  needsRebalance,
  positionAtEnd,
  positionAtStart,
  positionBetween,
  rebalancePositions,
} from "@/lib/position";

describe("positionAtEnd", () => {
  it("returns STEP for an empty list", () => {
    expect(positionAtEnd([])).toBe(POSITION_STEP);
  });
  it("returns last position + STEP", () => {
    expect(positionAtEnd([{ position: 100 }, { position: 2048 }])).toBe(2048 + POSITION_STEP);
  });
});

describe("positionAtStart", () => {
  it("returns STEP for an empty list", () => {
    expect(positionAtStart([])).toBe(POSITION_STEP);
  });
  it("returns half of the first position", () => {
    expect(positionAtStart([{ position: 1024 }])).toBe(512);
  });
});

describe("positionBetween", () => {
  it("returns STEP when both bounds are null", () => {
    expect(positionBetween(null, null)).toBe(POSITION_STEP);
  });
  it("returns half of after when before is null", () => {
    expect(positionBetween(null, 1000)).toBe(500);
  });
  it("returns before + STEP when after is null", () => {
    expect(positionBetween(1000, null)).toBe(1000 + POSITION_STEP);
  });
  it("returns the midpoint between two bounds", () => {
    expect(positionBetween(1000, 2000)).toBe(1500);
  });
  it("stays strictly between the bounds", () => {
    const p = positionBetween(1000, 1001);
    expect(p).toBeGreaterThan(1000);
    expect(p).toBeLessThan(1001);
  });
});

describe("needsRebalance", () => {
  it("is false for a healthy gap", () => {
    expect(needsRebalance(1000, 2000)).toBe(false);
  });
  it("is true once the gap shrinks below EPSILON", () => {
    expect(needsRebalance(1000, 1000 + POSITION_EPSILON / 2)).toBe(true);
  });
  it("fires while the midpoint is still strictly between the bounds", () => {
    // This is the invariant Plan 004 relies on: at the rebalance trigger
    // point, positionBetween still returns a distinct, correctly-ordered value.
    const before = 1000;
    const after = before + POSITION_EPSILON / 2;
    expect(needsRebalance(before, after)).toBe(true);
    const mid = positionBetween(before, after);
    expect(mid).toBeGreaterThan(before);
    expect(mid).toBeLessThan(after);
  });
});

describe("rebalancePositions", () => {
  it("returns evenly spaced positions starting at STEP", () => {
    expect(rebalancePositions(3)).toEqual([POSITION_STEP, 2 * POSITION_STEP, 3 * POSITION_STEP]);
  });
  it("returns an empty array for count 0", () => {
    expect(rebalancePositions(0)).toEqual([]);
  });
  it("returns strictly increasing positions", () => {
    const ps = rebalancePositions(50);
    for (let i = 1; i < ps.length; i++) expect(ps[i]!).toBeGreaterThan(ps[i - 1]!);
  });
});
```

**Verify**: `pnpm --filter web test` → all tests pass (this file alone has 13+ assertions across 6 describe blocks).

### Step 4: Write `src/server/api/permissions.test.ts`

Create `apps/web/src/server/api/permissions.test.ts` covering only the pure
`roleCan` helper:
```ts
import { describe, expect, it } from "vitest";

import { roleCan } from "@/server/api/permissions";

describe("roleCan", () => {
  it("owner satisfies every requirement", () => {
    expect(roleCan("owner", "viewer")).toBe(true);
    expect(roleCan("owner", "editor")).toBe(true);
    expect(roleCan("owner", "owner")).toBe(true);
  });
  it("editor can write but not admin", () => {
    expect(roleCan("editor", "viewer")).toBe(true);
    expect(roleCan("editor", "editor")).toBe(true);
    expect(roleCan("editor", "owner")).toBe(false);
  });
  it("viewer can only read", () => {
    expect(roleCan("viewer", "viewer")).toBe(true);
    expect(roleCan("viewer", "editor")).toBe(false);
    expect(roleCan("viewer", "owner")).toBe(false);
  });
});
```

> If importing `@/server/api/permissions` triggers an error about missing env
> vars or a database connection at import time, that is a STOP condition — see
> below. (It should not: `permissions.ts` imports the db only as a `type`, and
> the schema module it imports does not open a connection.)

**Verify**: `pnpm --filter web test` → all tests pass, including this file.

### Step 5: Wire the Turbo `test` task

In the repo-root `turbo.json`, add a `test` task to the `tasks` object,
mirroring the existing `lint` task:
```json
"test": { "dependsOn": ["^test"] }
```

**Verify**: `pnpm --filter web typecheck` → exit 0. `pnpm test --filter=web`
(or `pnpm --filter web test`) → all pass.

## Test plan

- New file `src/lib/position.test.ts` — covers happy paths, both null-bound
  branches of `positionBetween`, the `needsRebalance` boundary (the invariant
  Plan 004 depends on), and `rebalancePositions` spacing/monotonicity.
- New file `src/server/api/permissions.test.ts` — covers the full role ladder
  for `roleCan`.
- Structural pattern for future tests: these two files *are* the pattern.
- Verification: `pnpm --filter web test` → all pass; `pnpm --filter web typecheck` → exit 0.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter web test` exits 0 and reports all tests passing (≥16 tests total).
- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `apps/web/vitest.config.ts`, `apps/web/src/lib/position.test.ts`, and
      `apps/web/src/server/api/permissions.test.ts` all exist.
- [ ] `apps/web/package.json` has a `test` script and `vitest` in devDependencies.
- [ ] Root `turbo.json` has a `test` task.
- [ ] `git status` shows no modified files outside the in-scope list (plus
      `pnpm-lock.yaml`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `src/lib/position.ts` or `src/server/api/permissions.ts` no longer match the
  "Current state" excerpts (the codebase drifted — Plan 004 may have already
  changed `position.ts`'s callers; the pure functions themselves should be
  unchanged, but confirm).
- Importing `@/server/api/permissions` in the test throws an env-validation or
  database-connection error at import time. (Report it; do not paper over it by
  importing internal symbols or copy-pasting `roleCan` into the test.)
- `pnpm install` cannot resolve `vitest@^3.x` (network/registry issue).
- Any verification fails twice after a reasonable fix attempt.

## Maintenance notes

- This is the seed of the test suite. The next high-value targets (separate
  plans) are integration tests for the tRPC routers and the MCP scope gating —
  both need a test Postgres (e.g. `pg-mem` or Testcontainers), which is why they
  are deliberately out of scope here.
- A reviewer should confirm the tests assert *behavior*, not implementation, and
  that `vitest.config.ts`'s `SKIP_ENV_VALIDATION` does not leak into non-test
  builds (it is scoped to `test.env`).
- Once this lands, add `pnpm --filter web test` to CI (there is currently no CI
  pipeline — a separate finding).
</content>
</invoke>
