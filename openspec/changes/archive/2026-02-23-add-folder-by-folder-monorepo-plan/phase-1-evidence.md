# Phase 1 Evidence

## 2.1-2.5 Workspace Bootstrap Output

- Added workspace globs for `apps/*`, `packages/*`, and `tooling/*` in `pnpm-workspace.yaml`.
- Added root `turbo.json` task graph with Norish-aligned tasks: `build`, `dev`, `lint:check`, `typecheck`, `test`, `format`, and `deps:cycles`.
- Scaffolded:
  - `apps/web`
  - `packages/api`
  - `packages/auth`
  - `packages/db`
  - `packages/queue`
  - `packages/config`
  - `packages/shared`
  - `packages/i18n`
  - `packages/ui`
- Added root `typecheck` script and `turbo` dev dependency.
- Placeholder source files are Norish-owned TODO stubs (no `turbo-norish` starter app code transplanted).

## 2.6 Validation Commands

Executed commands:

1. `pnpm install` - passed
2. `pnpm lint:check` - passed
3. `pnpm run typecheck` - passed
4. `pnpm run deps:cycles` - passed (`No circular dependencies found.`)

Typecheck gate details:

- Root `typecheck` command uses `tsconfig.typecheck.json` for phase-1 bootstrap scope.
- The bootstrap typecheck excludes `__tests__` and validates production source/workspace scaffold files.

## 2.7 Rollback Checkpoint Status

- Created annotated tag: `monorepo-phase-1-checkpoint`
- Tag target commit: `d74d544`
- Note: `monorepo-phase-0-checkpoint` and `monorepo-phase-1-checkpoint` both currently reference `d74d544` in this local, uncommitted workspace state.
