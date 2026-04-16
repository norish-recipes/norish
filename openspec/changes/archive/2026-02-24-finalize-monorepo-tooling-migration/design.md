## Context

The Norish monorepo migration phases 0-6 relocated all product source code but left the developer tooling layer partially migrated. The `turbo-norish` repo (a create-t3-turbo fork customized for Norish) demonstrates the target state: tooling as proper workspace packages with composable exports. This design document records the key decisions for converting the current transitional tooling into the target architecture.

### Current State (norish)

| Tooling Concern | Current Location                                                          | Package? | Config Style                       |
| --------------- | ------------------------------------------------------------------------- | -------- | ---------------------------------- |
| ESLint          | `tooling/eslint/eslint.config.mjs` + root shim                            | No       | Monolithic flat config, FlatCompat |
| Prettier        | Root `.prettierrc` + `.prettierignore`                                    | No       | JSON config, no import sorting     |
| TypeScript      | Root `tsconfig.json` + `tsconfig.server.json` + `tsconfig.typecheck.json` | No       | Monolithic with 18 path aliases    |
| Vitest          | `tooling/vitest/vitest.config.ts` + `tooling/vitest/setup.ts` + root shim | No       | Centralized with hardcoded aliases |
| Tailwind        | `tooling/tailwind/theme.css` + `tooling/tailwind/hero.ts`                 | No       | CSS vars + HeroUI plugin           |
| CI Setup        | Inline in `.github/workflows/*.yml`                                       | No       | Per-workflow duplication           |

### Target State (turbo-norish reference)

| Tooling Concern | Location                          | Package Name              | Config Style                                     |
| --------------- | --------------------------------- | ------------------------- | ------------------------------------------------ |
| ESLint          | `tooling/eslint/`                 | `@norish/eslint-config`   | Modular exports: `./base`, `./react`, `./nextjs` |
| Prettier        | `tooling/prettier/`               | `@norish/prettier-config` | Shared JS config with import sorting             |
| TypeScript      | `tooling/typescript/`             | `@norish/tsconfig`        | Composable: `base.json`, `compiled-package.json` |
| Tailwind        | `tooling/tailwind/`               | `@norish/tailwind-config` | CSS exports: `./theme`, `./postcss-config`       |
| CI Setup        | `tooling/github/setup/action.yml` | N/A                       | Composite GitHub Action                          |

## Goals / Non-Goals

### Goals

- All tooling directories become proper pnpm workspace packages with `package.json` and defined exports.
- Each workspace (app/package) owns its lint/format/typecheck/clean scripts and composes shared configs.
- Root `devDependencies` reduces to orchestration-only: `turbo`, `typescript`, `@norish/prettier-config`, and `dotenv-cli` at most.
- Temporary root shims (`eslint.config.mjs`, `vitest.config.ts`, `tsdown.config.ts`) are removed.
- `pnpm-workspace.yaml` uses a dependency catalog for shared version management.
- CI uses a composite action for consistent environment setup.

### Non-Goals

- Changing the product source code, application behavior, or feature set.
- Migrating to a different UI component library (HeroUI stays; theme.css adapts to package export).
- Adopting turbo-norish's shadcn-ui theme tokens (norish has its own Material-inspired HeroUI theme).
- Splitting `apps/web` into multiple apps or adding Expo/mobile.
- Changing the database provider (norish uses `pg` directly, not `@vercel/postgres`).

## Decisions

### D1: ESLint Config Architecture

**Decision:** Adopt turbo-norish's modular export pattern (`base.ts`, `react.ts`, `nextjs.ts`) using `typescript-eslint` directly, dropping the `FlatCompat` shim and legacy plugin wrappers.

**Rationale:** The current norish ESLint config uses `FlatCompat` to bridge old-style plugins into ESLint v9 flat config. turbo-norish's approach uses `typescript-eslint` natively, which is cleaner and more maintainable. The `eslint-plugin-prettier` integration moves to per-workspace config composition.

**Migration note:** The current norish config has rules for `import/order`, `react/jsx-sort-props`, and `padding-line-between-statements` that turbo-norish doesn't include. These norish-specific rules MUST be preserved by extending the base config.

### D2: Prettier Config Package

**Decision:** Create `@norish/prettier-config` matching turbo-norish's pattern, adding the `@ianvs/prettier-plugin-sort-imports` plugin.

**Rationale:** Import sorting is currently handled by ESLint's `import/order` rule. Moving it to Prettier aligns with the turbo-norish pattern and is more reliable since Prettier runs on all files (not just TS/TSX). The `prettier-plugin-tailwindcss` plugin already exists in norish; it moves into the shared package.

**Migration note:** `.prettierrc` and `.prettierignore` at root are replaced by the package. `.prettierignore` patterns move into per-workspace `.prettierignore` or are handled by workspace `format` scripts with `--ignore-path`.

### D3: TypeScript Config Strategy

**Decision:** Create `@norish/tsconfig` with `base.json` and `compiled-package.json`, following turbo-norish's pattern. Remove root path aliases. Each workspace declares its own `paths` if needed.

**Rationale:** The current root `tsconfig.json` has 18 path aliases for every `@norish/*` package. In a proper workspace setup, TypeScript resolves workspace packages through `node_modules` symlinks from pnpm, making path aliases redundant. Per-workspace tsconfigs extending a shared base is the standard Turborepo pattern.

**Breaking change:** `tsconfig.server.json` and `tsconfig.typecheck.json` are removed. Server bundling (tsdown) and typecheck configs move to `apps/web/`.

### D4: Vitest Config Approach

**Decision:** Move vitest configuration to workspace-local configs rather than creating a separate `@norish/vitest-config` package. Each workspace with tests gets its own `vitest.config.ts` and setup files.

**Rationale:** Vitest configs are inherently workspace-specific (different environments, aliases, setup files). The current centralized config with 12 hardcoded path aliases is fragile. turbo-norish doesn't have a vitest tooling package either. Per-workspace configs that import shared test utilities from a `@norish/test-utils` package (if needed later) is more maintainable.

**Migration note:** The root `vitest.config.ts` shim and `tooling/vitest/` directory are removed. `apps/web` and any test-bearing package get their own vitest config. The `tooling/vitest/setup.ts` (next mocks, env vars) moves to `apps/web/__tests__/setup.ts`.

### D5: Tailwind Config as Package

**Decision:** Convert `tooling/tailwind/` to `@norish/tailwind-config` exporting `./theme` (CSS) and `./postcss-config`. Keep the HeroUI-specific `hero.ts` as a local export since turbo-norish uses shadcn (different component library).

**Rationale:** The theme.css and postcss-config are already structured for export. Adding a `package.json` with proper exports makes them consumable as `@norish/tailwind-config/theme` in CSS `@import` statements. HeroUI plugin integration stays norish-specific.

### D6: Dependency Catalog

**Decision:** Adopt `pnpm-workspace.yaml` `catalog:` for shared dependency versions, starting with TypeScript, ESLint, Prettier, Tailwind, Zod, React types, and Vite/Vitest.

**Rationale:** Currently, versions are scattered across 10+ `package.json` files. A catalog provides single-source version management and is a built-in pnpm feature. turbo-norish already uses this pattern.

### D7: CI Composite Action

**Decision:** Create `tooling/github/setup/action.yml` as a composite action that installs pnpm, sets up Node (from `.nvmrc`), installs turbo globally, and runs `pnpm install`.

**Rationale:** All 4 CI workflows repeat the same setup steps. A composite action reduces duplication and ensures consistency. turbo-norish has this pattern.

### D8: Move-and-Prune Discipline

**Decision:** Every task that relocates a file, config, or dependency SHALL atomically delete the source artifact in the same task step. No move is considered complete until the original is removed and the phase validation gate passes without the old path.

**Rationale:** The product code migration (phases 0-6) established this principle in the archived `add-folder-by-folder-monorepo-plan` change. Applying the same discipline to tooling migration prevents orphaned configs that silently shadow the new location (e.g., a leftover root `vitest.config.ts` overriding a workspace-local config) and keeps the hygiene policy enforceable at each gate.

**Applies to:**

- Config files relocated between directories (e.g. `tooling/vitest/setup.ts` -> `apps/web/__tests__/setup.ts`)
- Root config files relocated to workspaces (e.g. `tsdown.config.ts` -> `apps/web/tsdown.config.ts`)
- devDependencies moved from root `package.json` to owning workspace `package.json` (remove from root in the same step)
- Entire tooling directories that become empty after moves (e.g. `tooling/vitest/` after contents are distributed)

## Risks / Trade-offs

| Risk                                                           | Mitigation                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| ESLint rule changes introduce new lint violations              | Run lint across full codebase after conversion; commit autofix pass before switching        |
| Import ordering changes from Prettier plugin create large diff | Run `pnpm format:fix` as a dedicated commit before merging                                  |
| Removing root path aliases breaks IDE resolution               | Ensure pnpm workspace linking provides resolution; update `.vscode/settings.json` if needed |
| Per-workspace tsconfig drift                                   | `@norish/tsconfig` base enforces strict mode and shared options                             |
| CI workflow changes break pipeline                             | Test in a branch with PR quality checks before merging                                      |

## Migration Plan

### Phase A: Tooling Package Scaffolding

Create `package.json` files for tooling packages, add dependency catalog, move devDependencies out of root. Validate with `pnpm install`.

### Phase B: Config Conversion

Refactor ESLint to modular exports, create Prettier package, create TypeScript base configs, convert Tailwind to package. Validate each individually.

### Phase C: Workspace Adoption

Add per-workspace scripts and config references. Remove root shims. Validate with `turbo run lint`, `turbo run typecheck`, `turbo run format`.

### Phase D: Root Cleanup and CI

Slim root `package.json`, update CI workflows, update hygiene policy, remove obsolete root files. Full validation pass.

## Open Questions

- Should the `tooling/vitest/setup.ts` (next mocks) be extracted to a `@norish/test-utils` package, or is it simpler to keep it in `apps/web`? (Recommendation: keep in `apps/web` for now, extract only if multiple apps need it.)
- Should `tsdown.config.ts` move to `apps/web/` or should server bundling be handled differently? (Recommendation: move to `apps/web/tsdown.config.ts` since the web app owns the custom server.)
- Should `drizzle-kit` remain a root devDependency or move to `packages/db`? (Recommendation: move to `packages/db` where the schema lives.)
