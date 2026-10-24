# 13 — Vitest 5

Status: resolved
Blocked by: 11
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `vitest` from 4.1.11 to **5.0.x**. 5.0.4 was published on 2026-10-12; take the newest 5.0 patch when the work starts.

- **Declare `vite` (8.3.x)** next to `vitest` in every workspace that runs tests. It is now a required peer.
- **Add `@vitest/coverage-v8`.** `apps/web/vitest.config.ts` uses it, but it isn't installed.

Changes that touch Norish, from the v5.0.4 migration guide:

- **`vi.mock` inside `describe` now throws.** This hits `packages/auth/__tests__/auth/password-auth-cache.test.ts`, which has six calls. Hoist them to module level, or use `vi.doMock`.
- **`clearMocks` now defaults to true.** Tests that rely on calls recorded in setup files or in `beforeAll` change. There are 62 `beforeAll`s, plus `apps/web/__tests__/setup.ts`.
  - Land the bump behaviour-neutral by setting `clearMocks: false` in each config.
  - Adopting the new default is a follow-up.
- **Unawaited `.resolves` / `.rejects` now fail the test.**
- **`test.each` titles** are formatted with pretty-format.
- **Reports go to `.vitest/`.** Add it to `.gitignore`.
- **jest-dom typings break.** 7.0.1 still extends `jest.Matchers` / `Assertion<T>`, while Vitest 5 uses `Assertion<R, T>`. The runtime is fine, but since ticket 25 apps/web's `typecheck` includes `__tests__`, so this now fails the gate. Take a jest-dom release that supports Vitest 5 if one exists; otherwise add a local declaration that augments Vitest 5's `Assertion` with jest-dom's matchers.

**Later:**

- the stable `fsModuleCache`;
- `vitest doctor`;
- a root `test.projects` setup, which runs one process instead of ten turbo tasks, at the cost of turbo's per-package caching.

## Acceptance criteria

- [ ] **Same test counts.** Each package runs the same number of tests before and after, under `NODE_ENV=test pnpm test:run` as CI runs it.
- [ ] **Behaviour-neutral.** No test was weakened to make it pass. Any `clearMocks` changes are deliberate and listed in the comments.
- [ ] **Coverage.** `pnpm test:coverage` runs.
- [ ] **Gates.** `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build` pass.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - the vitest 5.0.4 tarball;
  - `docs/guide/migration/index.md` and `docs/blog/vitest-5.md` at v5.0.4;
  - @testing-library/jest-dom 7.0.1.
- 2026-10-13 — jest-dom typings are now a gate failure, not an editor nuisance, because ticket 25 type-checks apps/web's tests.
- 2026-10-13 — Done on Vitest 5.0.4. `vite` is declared next to `vitest` in every tested workspace, `@vitest/coverage-v8` is installed in apps/web, and `clearMocks: false` keeps every config behaviour-neutral (adopting the new default is a follow-up). `password-auth-cache.test.ts`'s mocks and their state moved to module level (Vitest hoisted them there anyway). jest-dom 7.0.1 is still the latest and augments the old `Assertion<T>`, so `apps/web/__tests__/jest-dom-vitest.d.ts` augments `Matchers<R, T>` instead (723 type errors otherwise). Per-package test counts are identical to Vitest 4 (api 509, auth 82, config 805, nutrition 36, queue 355, shared-react 99, shared-server 1041, shared 859, trpc 601, web 1233). `pnpm test:coverage` runs; `.vitest/` and `coverage/` are gitignored. `@types/node` is declared where tests run, since vite's optional peer otherwise auto-installs the newest.
