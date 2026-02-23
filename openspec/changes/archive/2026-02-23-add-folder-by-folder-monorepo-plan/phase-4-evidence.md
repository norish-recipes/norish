# Phase 4 Evidence

## 5.1-5.5 Web Relocation, Rewire, and UI Extraction

- Moved root web source folders into `apps/web` and pruned migrated root locations:
  - `app/**` -> `apps/web/app/**`
  - `components/**` -> `apps/web/components/**`
  - `context/**` -> `apps/web/context/**`
  - `hooks/**` -> `apps/web/hooks/**`
  - `stores/**` -> `apps/web/stores/**`
  - `styles/**` -> `apps/web/styles/**`
  - `public/**` -> `apps/web/public/**`
- Moved middleware from root `proxy.ts` to `apps/web/proxy.ts`.
- Added app-local Next/PostCSS config files:
  - `apps/web/next.config.js`
  - `apps/web/postcss.config.js`
- Rewired web API/middleware imports to package exports:
  - `apps/web/app/api/auth/[...all]/route.ts` -> `@norish/auth/auth`
  - `apps/web/app/api/trpc/[trpc]/route.ts` -> `@norish/api/trpc`
  - `apps/web/app/api/import/recipe/route.ts` -> `@norish/auth`, `@norish/db`, `@norish/queue/server-queue`, `@norish/api/logger`
  - `apps/web/proxy.ts` -> `@norish/auth/auth`
- Added package bridge exports to support phase-4 routing against package entrypoints while backend extraction is still in progress:
  - `packages/auth/src/auth.ts`
  - `packages/api/src/trpc.ts`
  - `packages/api/src/logger.ts`
  - `packages/queue/src/server-queue.ts`
  - `packages/db/src/index.ts` (bridge export)
- Extracted reusable rating primitives from web-local shared components to `packages/ui`:
  - `packages/ui/src/rating-stars.tsx`
  - `packages/ui/src/star-rating.tsx`
  - Updated app/test imports to `@norish/ui/rating-stars` and `@norish/ui/star-rating`

## 5.6 Cleanup Audit

Executed root-scope audit for phase-4 web ownership:

- `app: ABSENT`
- `components: ABSENT`
- `context: ABSENT`
- `hooks: ABSENT`
- `stores: ABSENT`
- `styles: ABSENT`
- `public: ABSENT`

Result:

- No duplicate authoritative modules remain in the phase-4 root web scopes.
- No intentional deferrals are recorded for root `app`, `components`, `context`, `hooks`, `stores`, `styles`, or `public`.

## 5.7 Validation Commands

Executed build-first validation gates:

1. `pnpm test:run` - passed (121 files, 1939 tests)
2. `pnpm run typecheck` - passed
3. `SKIP_ENV_VALIDATION=1 DATABASE_URL=postgresql://localhost:5432/norish pnpm build` - passed
4. `pnpm run deps:cycles` - passed (`No circular dependencies found.`)

Build gate notes:

- Root `build` script now builds Next.js from `apps/web`.
- Local phase validation ran build with `SKIP_ENV_VALIDATION=1 DATABASE_URL=postgresql://localhost:5432/norish pnpm build` to satisfy server config requirements without production secrets.
- Runtime startup/smoke checks remain deferred to phase 6 per build-first gating.

## 5.8 Rollback Checkpoint Status

- Created annotated tag: `monorepo-phase-4-checkpoint`
- Tag target commit: `4d85f1208d446140847a2fd6591f1e9053919e01`
