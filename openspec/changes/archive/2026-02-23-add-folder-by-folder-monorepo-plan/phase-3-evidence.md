# Phase 3 Evidence

## 4.1-4.5 Backend Extraction and Startup Composition

- Migrated backend source ownership out of legacy root `server/**` into package/app targets:
  - `server/db/**` -> `packages/db/src/**`
  - `server/auth/**` -> `packages/auth/src/**`
  - `server/trpc/**` + backend domain services (`ai`, `caldav`, `importers`, `lib`, `parser`, `services`, `timers`, `utils`, `video`, `downloader.ts`, `helpers.ts`, `logger.ts`, `playwright.ts`) -> `packages/api/src/**`
  - `server/queue/**`, `server/redis/**`, `server/scheduler/**` -> `packages/queue/src/**`
- Moved startup entrypoint from root `server.ts` to `apps/web/server/index.ts` and rewired it to package exports (`@norish/api/startup/*`, `@norish/api/caldav/event-listener`, `@norish/queue/start-workers`).
- Updated root scripts/config for new ownership paths:
  - `package.json` server/dev and Drizzle config script paths
  - `tsdown.config.ts` server build entrypoint
  - `tsconfig.server.json` include paths
  - `__tests__/helpers/db-setup.ts` Drizzle config reference
  - `.prettierignore` migration path
- Added package subpath exports needed by migrated imports:
  - `packages/api/package.json`
  - `packages/auth/package.json`
  - `packages/db/package.json`
  - `packages/queue/package.json`
- Updated server-env discovery to support monorepo build context (`packages/config/src/env-config-server.ts`) so production builds can fall back to root `.env.local` when `.env.production` is absent.

## 4.6 Cleanup Audit

Executed root backend ownership audit:

- `server/**: ABSENT`

Result:

- No duplicate authoritative backend modules remain in root `server/**`.
- No intentional phase-3 backend deferrals are recorded.

## 4.7 Validation Commands

Executed build-first validation gates:

1. `pnpm test:run` - passed (121 files, 1939 tests)
2. `pnpm run typecheck` - passed
3. `pnpm build` - passed
4. `pnpm run deps:cycles` - passed (`No circular dependencies found.`)
5. `openspec validate add-folder-by-folder-monorepo-plan --strict --no-interactive` - passed

## 4.8 Rollback Checkpoint Status

- Created annotated tag: `monorepo-phase-3-checkpoint`
- Tag target commit: `5fd696be9ff7e1fbfa270cb1aa87c0bc782d6a12`
