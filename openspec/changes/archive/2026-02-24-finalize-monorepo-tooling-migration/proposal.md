# Change: Finalize Monorepo Tooling Migration

## Why

The Norish monorepo migration (phases 0-6) successfully relocated all product source code into `apps/` and `packages/`. However, the tooling layer was left in a transitional state: `tooling/eslint/`, `tooling/vitest/`, and `tooling/tailwind/` are plain config-file directories -- not proper pnpm workspace packages -- despite `tooling/*` being declared in `pnpm-workspace.yaml`. The root `package.json` still carries 27+ devDependencies that belong to tooling packages, ESLint and Prettier configs live as root-only files rather than composable shared packages, TypeScript configuration is monolithic with duplicated path aliases, and per-workspace scripts for linting/formatting/typechecking are absent.

Meanwhile, the `turbo-norish` reference repo demonstrates the proven target state: tooling directories as proper npm packages (`@norish/eslint-config`, `@norish/prettier-config`, `@norish/tsconfig`, `@norish/tailwind-config`), per-workspace lint/format/typecheck scripts orchestrated by Turbo, a `pnpm-workspace.yaml` dependency catalog for centralized version management, a composite GitHub Action for CI setup, and a `.nvmrc` for pinning Node version.

This change completes the tooling migration by converting tooling directories to real workspace packages, adopting the composable config patterns from `turbo-norish`, and removing the root shims and dependency bloat that remain from the legacy setup.

## What Changes

### Tooling Package Conversion (Core)

- Convert `tooling/eslint/` into proper `@norish/eslint-config` workspace package with `package.json`, exports for `./base`, `./react`, `./nextjs`, and own devDependencies for all ESLint plugins.
- Refactor the monolithic `tooling/eslint/eslint.config.mjs` into modular configs (`base.ts`, `react.ts`, `nextjs.ts`) following turbo-norish's composable pattern.
- Create `tooling/prettier/` as `@norish/prettier-config` workspace package exporting a shared Prettier config with import-sort and Tailwind plugins. Remove root `.prettierrc` and `.prettierignore`.
- Create `tooling/typescript/` as `@norish/tsconfig` workspace package exporting `base.json` and `compiled-package.json`. Migrate from monolithic root `tsconfig.json` with duplicated path aliases.
- Convert `tooling/tailwind/` into proper `@norish/tailwind-config` workspace package with `package.json` and exports for `./theme` and `./postcss-config`.
- Convert `tooling/vitest/` into proper `@norish/vitest-config` workspace package (or merge vitest config into workspace-local test configs, removing the root shim).

### Root Dependency Slimming

- Move ESLint plugins, Prettier plugins, Vitest, jsdom, PostCSS, Tailwind, and related devDependencies from root `package.json` into owning tooling packages.
- Root `devDependencies` reduces to: `turbo`, `typescript`, `@norish/prettier-config`, and minimal orchestration tools.
- Adopt `pnpm-workspace.yaml` dependency catalog for centralized version management of shared dependencies (TypeScript, ESLint, Prettier, Tailwind, Zod, etc.).

### Per-Workspace Script Delegation

- Add `lint`, `format`, `typecheck`, and `clean` scripts to each workspace `package.json`.
- Each workspace's `eslint.config.ts` composes from `@norish/eslint-config` exports.
- Each workspace's `package.json` declares `"prettier": "@norish/prettier-config"`.
- Each workspace's `tsconfig.json` extends `@norish/tsconfig/base.json` or `@norish/tsconfig/compiled-package.json`.
- Update root scripts to delegate via Turbo (`turbo run lint`, `turbo run format`, etc.).

### Root Shim Removal

- Remove `eslint.config.mjs` root shim (temporary, `removeBy: 2026-06-30`).
- Remove `vitest.config.ts` root shim (temporary, `removeBy: 2026-06-30`).
- Relocate `tsdown.config.ts` into `apps/web/` where it belongs (temporary shim, `removeBy: 2026-06-30`).
- Remove root `tsconfig.server.json` and `tsconfig.typecheck.json` (superseded by workspace-owned configs).

### CI and Environment Alignment

- Add `.nvmrc` pinning Node 24.13.1.
- Create `tooling/github/setup/action.yml` composite action for CI setup consistency.
- Update GitHub Actions workflows to use the composite action and Turbo-delegated tasks.
- Update `turbo.json` to add `globalEnv`, `globalPassThroughEnv`, task caching, and output configuration from turbo-norish.

### Move-and-Prune Discipline

- Every task that relocates a file or dependency SHALL delete the source artifact in the same task step. Moves are atomic: copy-to-destination + verify + delete-source, never copy-only.
- This applies to config files moved between directories (e.g. `tooling/vitest/setup.ts` -> `apps/web/__tests__/setup.ts`), root config files relocated to workspaces (e.g. `tsdown.config.ts` -> `apps/web/`), and devDependencies moved from root to owning packages (e.g. `drizzle-kit` -> `packages/db`).
- After each phase validation gate, no orphaned source artifacts from that phase's moves SHALL remain.

### Hygiene Policy Update

- Update `tooling/monorepo/root-hygiene-policy.json` to remove temporary shims and tighten allowlists.
- Remove eslint/prettier/vitest/tsconfig-related entries from `allowedRootFiles` and `allowedRootDevDependencies`.

## Impact

- Affected specs:
  - `monorepo-architecture` -- Root manifest reduced to workspace control plane
  - `monorepo-folder-placement` -- Tooling directories become proper packages, root file allowlist tightened
  - `monorepo-migration-phasing` -- Completes hardening exit criteria
  - `dependency-boundaries` -- Workspace dependency declarations become authoritative for tooling
- Affected code:
  - `tooling/*` -- All tooling directories gain `package.json`, restructured configs
  - `package.json` (root) -- Dramatic devDependency reduction, script changes
  - `pnpm-workspace.yaml` -- Dependency catalog added
  - `turbo.json` -- Enhanced task configuration
  - `apps/web/package.json`, `packages/*/package.json` -- New scripts, tooling devDeps, prettier/tsconfig refs
  - `.github/workflows/*` -- Composite action usage, Turbo delegation
  - Root config files -- `.prettierrc`, `.prettierignore`, `eslint.config.mjs`, `vitest.config.ts`, `tsdown.config.ts`, `tsconfig.server.json`, `tsconfig.typecheck.json` removed/relocated
- Risk profile:
  - Medium: config restructuring can break lint/build/test pipelines; mitigated by sequential phases with validation gates after each.
