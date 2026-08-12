# Plan 003: Bind invite acceptance to the invited email and gate `listInvites` to admins

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 29b619a..HEAD -- apps/web/src/server/api/routers/project.ts`
> If `project.ts` changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `29b619a`, 2026-06-18

## Why this matters

Two related authorization gaps in the project-invite flow:

1. **`acceptInvite` does not bind the invite to the invited email.** It looks up
   the invite by token, checks expiry and `acceptedAt`, then adds the
   **currently logged-in user** to the project — it never compares
   `inv.email` to `ctx.session.user.email`. The invite token is also stored in
   the recipient's `project.invited` notification `data` (so it is visible
   in-app and can be forwarded). Result: any authenticated Kanbi user who
   obtains a token can join the project as the invited role, regardless of which
   email it was sent to.

2. **`listInvites` leaks invitee emails and tokens to any project member.** It is
   a plain `projectProcedure` query returning `select()` (all columns, including
   `email` and `token`) with **no admin gate** — unlike `revokeInvite`, which
   checks `ctx.access.canAdmin`. Any viewer/editor can enumerate every pending
   invite's destination email (PII) and token (which compounds gap #1).

Both fixes are one added check each, using helpers and context fields that
already exist in the file.

## Current state

File: `src/server/api/routers/project.ts`. It already imports `TRPCError`
(line 1) and `assertCanAdmin` (line 13).

- `acceptInvite` (lines 407–470) — a `protectedProcedure`. Current body
  (abridged to the relevant part):
  ```ts
  acceptInvite: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const row = await ctx.db
        .select()
        .from(projectInvite)
        .where(eq(projectInvite.token, input.token))
        .limit(1);
      const inv = row[0];
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });
      if (inv.acceptedAt) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite already used" });
      }
      if (inv.expiresAt && inv.expiresAt < now) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invite expired" });
      }

      const userId = ctx.session.user.id;
      await ctx.db.insert(projectMember).values({ /* ... */ }).onConflictDoUpdate({ /* ... */ });
      await ctx.db.update(projectInvite).set({ acceptedAt: now }).where(eq(projectInvite.id, inv.id));
      // ... createNotifications(project.member_joined) ...
      return { projectSlug: /* ... */ };
    }),
  ```
  `inv` is the full `projectInvite` row, so `inv.email` is available.
  `ctx.session.user.email` is guaranteed present: `protectedProcedure`
  guarantees `ctx.session.user` is non-null, and the Better Auth user (and the
  device-token-synthesized session) both carry `email`.

- `listInvites` (lines 380–391) — current body:
  ```ts
  listInvites: projectProcedure.query(({ ctx, input }) =>
    ctx.db
      .select()
      .from(projectInvite)
      .where(and(eq(projectInvite.projectId, input.projectId)))
      .orderBy(desc(projectInvite.createdAt)),
  ),
  ```
  Note it is an arrow that returns the query directly (no block body). The
  adjacent `revokeInvite` (lines 393–405) shows the admin-gate pattern:
  `if (!ctx.access.canAdmin) throw new TRPCError({ code: "FORBIDDEN" });`.
  `projectProcedure` populates `ctx.access` with `{ role, canWrite, canAdmin }`.

## Commands you will need

| Purpose         | Command                          | Expected on success |
|-----------------|----------------------------------|---------------------|
| Install deps    | `pnpm install`                   | exit 0              |
| Typecheck (web) | `pnpm --filter web typecheck`    | exit 0, no errors   |
| Tests (web)     | `pnpm --filter web test`         | all pass (if Plan 001 landed) |

> Gate on `pnpm --filter web typecheck`. `pnpm lint` has a pre-existing
> unrelated error — ignore it.

## Scope

**In scope** (the only files you should modify):
- `apps/web/src/server/api/routers/project.ts`
- `plans/README.md` (status update)

**Out of scope** (do NOT touch):
- The invite **creation** path (`invite`/`createInvite`) and the email-sending
  code — they are fine.
- The notification `data: { token }` payload — leave it; fixing #1 makes a
  forwarded token harmless because the email must match.
- Any schema change. (Wrapping the accept in a DB transaction to dedupe the
  double "member joined" notification is a *separate, optional* hardening item —
  see Maintenance notes — do not do it here.)

## Git workflow

- Branch: `advisor/003-invite-authz`
- Conventional commit, e.g. `fix(security): bind invite acceptance to invited email; gate listInvites to admins`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Bind `acceptInvite` to the invited email

In `acceptInvite`, **after** the `expiresAt` check and **before**
`const userId = ctx.session.user.id;`, add:
```ts
const sessionEmail = ctx.session.user.email?.toLowerCase();
if (!sessionEmail || sessionEmail !== inv.email.toLowerCase()) {
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "This invite was sent to a different email address.",
  });
}
```

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `grep -n "different email address" apps/web/src/server/api/routers/project.ts` → 1 match.

### Step 2: Gate `listInvites` to admins

Convert `listInvites` from a direct-return arrow to a block body that asserts
admin first, mirroring `revokeInvite`:
```ts
listInvites: projectProcedure.query(({ ctx, input }) => {
  assertCanAdmin(ctx.access);
  return ctx.db
    .select()
    .from(projectInvite)
    .where(and(eq(projectInvite.projectId, input.projectId)))
    .orderBy(desc(projectInvite.createdAt));
}),
```
(`assertCanAdmin` is already imported. It throws `FORBIDDEN` when
`!ctx.access.canAdmin`.)

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- `grep -n "assertCanAdmin(ctx.access)" apps/web/src/server/api/routers/project.ts`
  → at least 1 match inside `listInvites` (plus any pre-existing uses).

### Step 3: Confirm the client still works for the legitimate path

The settings UI lists invites only on the members/admin surface. Because
`listInvites` is now admin-only, confirm no non-admin component calls it:
```
grep -rn "listInvites" apps/web/src/app
```
**Verify**: every call site is in an admin-gated settings component (e.g. under
`settings/_components/`). If a non-admin surface calls `listInvites`, that is a
STOP condition (the UI would now error for non-admins) — report it; do **not**
weaken the gate to accommodate it.

### Step 4: Full verification

**Verify**:
- `pnpm --filter web typecheck` → exit 0.
- If Plan 001 landed: `pnpm --filter web test` → all pass.
- `git status --short` → only `project.ts` and `plans/README.md` changed.

## Test plan

No test database exists yet, so these are verified by typecheck + grep + the
Step 3 call-site audit. When a router test harness lands (separate plan), add:
- `acceptInvite` with a session email ≠ `inv.email` → expects `FORBIDDEN`.
- `acceptInvite` with a matching email → succeeds and inserts the member.
- `listInvites` called by a viewer/editor → expects `FORBIDDEN`; by an owner →
  returns rows.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter web typecheck` exits 0.
- [ ] `acceptInvite` throws `FORBIDDEN` when `ctx.session.user.email` ≠ `inv.email`
      (verified by reading the diff; `grep` for "different email address" → 1).
- [ ] `listInvites` calls `assertCanAdmin(ctx.access)` before querying.
- [ ] Step 3 confirms no non-admin UI surface calls `listInvites`.
- [ ] No files outside the in-scope list modified (`git status`).
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back (do not improvise) if:

- `acceptInvite` or `listInvites` no longer matches the "Current state" excerpt.
- `ctx.session.user.email` is not typed as a string (typecheck error) — report
  it; the session type may have changed.
- A non-admin UI component depends on `listInvites` (Step 3) — gating it would
  break that surface; report so the maintainer can decide (e.g. a narrower
  endpoint that returns counts only).

## Maintenance notes

- **Deferred, optional hardening** (not in this plan): the accept flow reads
  `inv.acceptedAt`, then inserts the member, then updates `acceptedAt` in three
  separate statements with no transaction. Two concurrent requests with the same
  token can both pass the "already used" check and both send the inviter a
  "member joined" notification (the `onConflictDoUpdate` prevents duplicate
  membership, so only the notification doubles). Wrapping the read + both writes
  in `ctx.db.transaction(...)` closes this. Low severity; separate change.
- A reviewer should confirm the email comparison is case-insensitive on both
  sides and that the check sits *after* the existing expiry/used checks (so the
  error precedence is: not-found → already-used → expired → wrong-email).
- Once invites are email-bound, the token in the notification `data` payload is
  no longer a standalone credential, but consider dropping it from the payload
  in a later cleanup since the UI does not need it.
</content>
