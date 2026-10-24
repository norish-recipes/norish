# 31 — Vitest 5's clearMocks default

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. Found in the branch review on 2026-10-13.

## What to build

Ticket 13 kept `clearMocks: false` in all 11 Vitest configs ("kept off so the upgrade changes no test"). Vitest 5 defaults it to `true`, so the option turns the new behaviour back off. The configs are in `apps/web`, `tooling/nutrition`, and `packages/{api,auth,config,db,queue,shared,shared-react,shared-server,trpc}`.

1. Delete the option from every config.
2. Fix the tests that relied on mock calls surviving into a test, for example calls recorded in `beforeAll` or at module scope.
3. Delete the hand-written `vi.clearAllMocks()` calls that now only repeat the default. About 173 test files have one, mostly in `beforeEach`.

## Acceptance criteria

- [x] No Vitest config sets `clearMocks`.
- [x] No `vi.clearAllMocks()` remains that only repeats what the default already does.
- [x] `pnpm test:run` passes, and a second run passes too.

## Comments

- Filed 2026-10-13 from the branch review. The maintainer did not accept the opt-out: adopt the default.
- 2026-10-14: Removed `clearMocks: false` and its comment from all 11 configs, and 197 of the 198 `vi.clearAllMocks()` calls across 173 test files (42 hooks went with them: 38 whose only statement it was, 4 one-line `beforeEach(() => vi.clearAllMocks())`). In Vitest 5.0.4 the default runs `vi.clearAllMocks()` before each test's `beforeEach` hooks, and clearing keeps implementations and `*Once` queues, so a `beforeEach` that clears first, or an `afterEach` that clears, only repeated it; no removed call followed an outer or earlier hook that calls mocks. The one kept is mid-test, in `apps/web/__tests__/app/settings/recipe-archive-export-route.test.ts`, between its two requests. No test needed a real fix: every suite passed with the default on before any call was removed, so nothing relied on calls surviving from `beforeAll` or module scope. Two full `pnpm test:run` runs passed (the second with `--force`), 10/10 tasks and 5,695 tests each; `packages/db` passed on its own too (30 files, 315 tests), and `tooling/nutrition` (3 files, 36 tests) is in the turbo run. Twice during the work, a full shared-server run failed while another session's `docker build` loaded the machine: the Postgres-backed suites' `beforeAll` timed out at 60s, and `publisher-redis.test.ts` › "answers a command sent while Redis restarts" ran past its 5s `commandTimeout`. Both passed every time without the build running, and they use no mocks.
