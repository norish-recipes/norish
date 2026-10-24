# 11 — TypeScript 6 and the toolchain minors

Status: resolved
Blocked by: 25 (type checking), 28 (lockfile refresh)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

**TypeScript.** Move `typescript` in the catalog from 5.9.3 to **6.0.3**.

- The lockfile resolved 6.0.3 as a peer for `@trpc/*`, next-intl, `@serwist/*` and apps/web's tsdown, pulled in by apps/mobile's `~6.0.3`. Ticket 23 takes apps/mobile out first; this move leaves one TypeScript.
- TypeScript 7 is held: typescript-eslint requires `<6.1.0`, and Next's build-time check needs the classic compiler API. No side-by-side install (spec decision 3).

**Minor and patch bumps, in the same PR:**

- `typescript-eslint`, `@eslint/compat`, `globals`, `eslint-plugin-turbo` to latest;
- `turbo`, `prettier`, `tsx` to latest;
- `vite`, `@vitejs/plugin-react` to latest;
- `@playwright/test` and `playwright-core` to latest. The server uses `connectOverCDP`, so the client and browser versions are not coupled;
- `drizzle-kit` to latest 0.31.x.

pnpm itself moves in ticket 16.

**TypeScript 6 changes that touch Norish** (checked in the 6.0.3 compiler source):

- **`types` now defaults to `[]`.** `tooling/typescript/base.json` sets no `types`.
  - Effect: web, landing, api, auth, db, i18n, queue, trpc and ui all lose the implicit `@types/node`.
  - packages/db, which type-checks for real, would fail on its Node globals, and the `--noCheck` declaration builds would quietly emit `any`.
  - Fix: add `"types": ["node"]` to `base.json`. `apps/web/tsconfig.sw.json` keeps its explicit `[]`.
- **`noUncheckedSideEffectImports` is on by default.**
  - `apps/landing/app/layout.tsx` imports `./globals.css`, which resolves only through `next-env.d.ts`. That file is gitignored, so landing's typecheck fails on a clean checkout.
  - Fix: run `next typegen` before landing's `typecheck`, or declare `*.css` side-effect modules.
- **`dom.iterable` is folded into `dom`.** The entries in `apps/web/tsconfig.json` and `apps/landing/tsconfig.json` are now redundant; remove them.
- **Options deprecated in 6 and removed in 7** — `baseUrl`, `node10`/classic resolution, an ES5 target, `esModuleInterop: false`, `outFile`, AMD/UMD/System modules, `downlevelIteration`. None appear in a gated workspace. `apps/docs/tsconfig.json` uses `baseUrl` but stays on its own TypeScript (ticket 22).

**Hygiene, while touching the manifests:**

- Declare `typescript: catalog:` in every workspace that runs `tsc`; today they rely on root hoisting.
- Move `tsx`, which is pinned in three places, into the catalog.

## Acceptance criteria

- [ ] **One TypeScript.** `pnpm why typescript` shows a single 6.0.3 outside apps/mobile.
- [ ] **Type check.** `pnpm typecheck` passes (real checks since ticket 25).
- [ ] **No new `any`.** Diffing `packages/*/dist/*.d.ts` before and after shows no new `any`.
- [ ] **Landing.** Landing's `typecheck` passes on a clean checkout.
- [ ] **Gates.** `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build` pass.

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - the typescript 6.0.3 and 7.0.2 tarballs;
  - typescript-eslint 8.71.1's peer range (`>=4.8.4 <6.1.0`).
- 2026-10-13 — Versions say "latest" instead of 2026-10-12 numbers; eslint-plugin-import removal moved to ticket 12; pnpm moved to ticket 16.
- 2026-10-13 — Done: one TypeScript (6.0.3) across the workspace, `"types": ["node"]` in `tooling/typescript/base.json`, `dom.iterable` dropped, `typescript: catalog:` declared in every workspace that runs `tsc`, `tsx` in the catalog. Toolchain floors raised to what ticket 28's re-lock already resolved. Landing and web type-check without `next-env.d.ts`, so no `next typegen` step was needed. The Playwright 1.64 bump needs a Chrome for Testing download from `storage.googleapis.com`, which the maintainer's DNS blocks; E2E waits on that.
