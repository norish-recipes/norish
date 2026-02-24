# Change: Resolve Phase B7 cyclic dependency blocker

## Why

Phase B of `finalize-monorepo-tooling-migration` is blocked at B7 validation because the cycle gate currently fails with four circular dependency chains. The cycles cross `@norish/config`, `@norish/db`, `@norish/auth`, and `@norish/api`, so Phase C root cleanup cannot safely proceed until dependency direction is restored.

## What Changes

- Add explicit dependency-boundary requirements that keep repository modules infrastructure-only and prevent them from importing service-layer modules.
- Require server config loaders and other cross-package callers to use scoped repository entry points instead of broad repository barrels that pull in unrelated modules.
- Add a Phase B7 cycle-exit requirement that mandates `pnpm run deps:cycles` passing alongside lint/typecheck/format/test/build before Phase C can begin.
- Define a remediation-first phase behavior: when B7 cycle validation fails, implementation must add and complete cycle-remediation tasks before continuing migration phases.

## Impact

- Affected specs:
  - `dependency-boundaries`
  - `monorepo-migration-phasing`
- Affected code:
  - `packages/config/src/server-config-loader.ts`
  - `packages/db/src/repositories/index.ts`
  - `packages/db/src/repositories/api-keys.ts`
  - `packages/db/src/repositories/ingredients.ts`
  - `packages/db/src/repositories/recipes.ts`
  - `packages/api/src/downloader.ts`
  - `packages/auth/src/auth.ts`
  - `tooling/monorepo/scripts/check-circular-deps.mjs`
