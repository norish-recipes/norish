## Context

Running `pnpm run deps:cycles` during Phase B7 currently reports four cycles:

1. `packages/auth/src/auth.ts -> packages/config/src/server-config-loader.ts -> packages/db/src/repositories/index.ts -> packages/db/src/repositories/api-keys.ts`
2. `packages/config/src/server-config-loader.ts -> packages/db/src/repositories/index.ts -> packages/db/src/repositories/ingredients.ts`
3. `packages/config/src/server-config-loader.ts -> packages/db/src/repositories/index.ts -> packages/db/src/repositories/recipes.ts -> packages/api/src/downloader.ts`
4. `packages/config/src/server-config-loader.ts -> packages/db/src/repositories/index.ts -> packages/db/src/repositories/recipes.ts`

The common root is a broad repository barrel import in `server-config-loader` that pulls in repository modules with higher-layer dependencies (`auth`, `api`, and config loader callbacks), violating intended direction.

## Goals / Non-Goals

- Goals:
  - Restore acyclic import direction so Phase B7 can pass and Phase C can proceed.
  - Keep remediation scoped to dependency ownership and import boundaries.
  - Preserve existing runtime behavior for auth, config reads, and recipe/media operations.
- Non-Goals:
  - Re-architect auth, downloader, or config domains beyond what is needed to remove cycles.
  - Introduce new tooling or dependency graph frameworks.

## Decisions

- Decision: enforce leaf-level repository imports for config access.
  - `@norish/config/server-config-loader` should import only the specific repository module it needs (for example server-config repository functions), not `@norish/db/repositories` barrel exports.
- Decision: keep repository modules infrastructure-only.
  - Repository code should depend on schema, drizzle, and shared utilities, but should not import service-level modules from `@norish/auth`, `@norish/api`, or config loader modules.
- Decision: treat B7 as a hard cycle gate.
  - Phase B7 is incomplete until `pnpm run deps:cycles` passes with zero cycles in addition to lint/typecheck/format/test/build gates.

## Risks / Trade-offs

- Risk: moving logic between repositories and service modules can cause behavior drift.
  - Mitigation: keep interfaces stable and verify with existing test and build gates.
- Risk: over-scoping refactors while fixing cycles.
  - Mitigation: constrain work to cycle edges identified by `deps:cycles` output and stop once graph is clean.

## Migration Plan

1. Replace broad imports causing fan-in cycles with scoped imports.
2. Move or invert cycle-causing calls so repositories no longer import service-layer modules.
3. Re-run `pnpm run deps:cycles` until zero cycles.
4. Re-run Phase B7 validation suite (lint/typecheck/format/test/build).

## Open Questions

- None.
