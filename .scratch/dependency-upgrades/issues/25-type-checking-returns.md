# 25 — Type checking returns

Status: resolved
Blocked by: None. It is the first code commit of the sweep.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

**The gates don't type-check today:**

- `apps/web/tsconfig.json` sets `"noCheck": true` (#333), so `next build`'s check is skipped too.
- Six workspace `typecheck` scripts pass `--noCheck`: api, auth, queue, shared-react, shared-server and trpc. trpc's `typecheck` is really its dist refresh (`rm -rf dist .cache && tsc --noCheck`).
- `.github/workflows/_node-ci.yml` has no typecheck step.

**Why first.** Several breaking changes in this sweep are plain type errors that no gate reports: BullMQ 6's removed `repeat` and `Queue.client`, Better Auth 1.7's removed client plugin, HeroUI prop changes. Making the check real before any major bump turns them into gate failures.

**Where it stands** (real `tsc --noEmit --noCheck false`, 2026-10-13):

| Workspace              | Errors                                        | Notes                                                                                                                                                           |
| ---------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| packages/trpc          | 39 (30 own)                                   | 28 share one cause: the `actorOf(ctx)` parameter type (`household.users[].name` is nullable). One zod `.default({})` needs the full default.                    |
| packages/shared-react  | 13 (5 own)                                    | Two mutation shapes (`use-recipes-mutations.ts:218`, `use-convert-mutation.ts:78`).                                                                             |
| packages/queue         | 8 (4 own)                                     | `incr` on `IRedisClient`, `KeepJobs` narrowing, a `string \| undefined`.                                                                                        |
| packages/api           | 8 (0 own)                                     | All from queue and shared-server.                                                                                                                               |
| packages/shared-server | 0 own, 4 seen by every consumer               | Green only because its tsconfig sets `noUncheckedIndexedAccess: false`. Fix the 4 (`category-matcher.ts:139`, `allergy-detector.ts:111`) and drop the override. |
| packages/auth          | 1                                             | `createBetterAuth() as AuthInstance` needs a real type or a cast through `unknown`.                                                                             |
| apps/web               | 321 (139 source, 167 tests, 15 from packages) | About 214 are possibly-undefined (`noUncheckedIndexedAccess`); about 50 are HeroUI v2 props left on v3 components, motion `Transition` types and draft types.   |
| everything else        | 0                                             | config, db, db-schema, i18n, shared, ui, landing, `tsconfig.sw.json`, tooling.                                                                                  |

**Order:**

1. **Packages first.** Fix shared-server's 4 and drop its `noUncheckedIndexedAccess: false`; then auth, queue, shared-react and trpc. Remove `--noCheck` from each `typecheck` script. trpc keeps a separate script for its dist refresh.
2. **apps/web.** Remove `noCheck` and fix the errors. For a possibly-undefined value, prefer a guard that matches what the code means; use `!` only where the value is provably present, never to silence a real gap.
3. **CI.** Add a `pnpm typecheck` step to `_node-ci.yml`, and add it to the definition of done in `CONTRIBUTING.md` and `AGENTS.md`.

**Real bugs this finds, fixed in the same commits:**

- `apps/web/app/(app)/settings/caldav/components/caldav-config-card.tsx:33` takes `onOpen`/`onClose` from HeroUI v3's `useOverlayState()`, which only provides `open`/`close`. The CalDAV **Edit** button does nothing, and the edit modal gets no `onClose`.
- HeroUI v2 props on v3 components are silently ignored: Switch `color`, Link `isExternal`/`size`, Input `variant`, Button `isIconOnly`. Map each to its v3 equivalent, or remove it; check the affected screens by eye.
- `signIn.oauth2` is a typing gap only: the `AuthClient` type hides the generic-OAuth plugin. Ticket 09 replaces the call anyway; type it correctly here.

**Out of scope.** About 310 package test files sit outside every package tsconfig (`include: ["src"]`), so a real check never sees them. Bringing them in is a separate change. apps/web's `__tests__` are included and are fixed here.

**TypeScript 7 is held** (spec decision 3): no side-by-side install. It moves when typescript-eslint supports it.

## Acceptance criteria

- [x] **No `noCheck`.** No tsconfig sets `noCheck`, and no `typecheck` script passes `--noCheck`.
- [x] **Green.** `pnpm typecheck` passes on a clean checkout (after `pnpm --filter @norish/trpc build`, if the dist is needed).
- [x] **CI.** `_node-ci.yml` runs `pnpm typecheck` and fails on errors.
- [x] **CalDAV.** The Edit button opens the edit modal, and the modal closes; a test covers it.
- [x] **No silencing.** No new `as any`, `@ts-ignore` or `@ts-expect-error`.
- [x] **Gates and E2E.** The repo gates pass, and `pnpm test:e2e` passes (the full suite ran with ticket 18: 173 passed).

## Comments

- Filed 2026-10-12 with the spec as "Type checking comes back, then TypeScript 7" (needs-triage).
- 2026-10-13 — The maintainer made it the first step of the sweep and held TypeScript 7 without a side-by-side install. Error counts measured the same day; logs were kept outside the repo.
- 2026-10-13 — Done on `chore/dependency-upgrades`. Beyond the counts above it found: the optimistic recipe edit cached rows without ids and cuisine ids in place of entries; the store-delete "Delete items" option was unselectable; the note editor had no date field; the share panel's Open link was a dead button; several clickable chips were spans; `planned-recipe.d.ts` and `notes.d.ts` referenced deleted schemas, so `Slot` and the calendar item types were silently `any` (`.d.ts` + `skipLibCheck`). Those two files are gone and `Slot` comes from `slotSchema`. `apps/web/lib/auth/client.ts` was an unused copy and is deleted.
