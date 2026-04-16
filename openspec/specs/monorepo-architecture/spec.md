# monorepo-architecture Specification

## Purpose

TBD - created by archiving change refactor-turborepo-monorepo-foundation. Update Purpose after archive.

## Requirements

### Requirement: Tailored Turborepo Workspace Layout

The repository SHALL adopt a Turborepo workspace layout tailored to Norish, with `apps/*` and `packages/*` boundaries and no unrelated template applications.

#### Scenario: Workspace structure is created for Norish scope

- **WHEN** the migration scaffolds the monorepo structure
- **THEN** the repository SHALL contain an `apps/web` application
- **AND** backend and shared logic SHALL be placed under `packages/*`
- **AND** no unused template apps (for example Expo or alternate web frameworks) SHALL be introduced

#### Scenario: All workspace packages are included in Dockerfile

- **WHEN** the Docker image is built from the repository root
- **THEN** every `packages/*/package.json` file listed in `pnpm-workspace.yaml` SHALL be copied in both the `deps` and `prod-deps` stages
- **AND** every `tooling/*/package.json` file for workspace packages SHALL be copied
- **AND** the `patches/` directory SHALL be copied when `patchedDependencies` exist in `pnpm-workspace.yaml`

#### Scenario: Docker ignore rules allow required build artifacts

- **WHEN** the Docker build context is assembled
- **THEN** `packages/trpc/dist/` (type declaration files) SHALL NOT be excluded
- **AND** `apps/mobile/` SHALL be excluded (not needed in Docker)
- **AND** `openspec/` SHALL be excluded (not needed in Docker)

#### Scenario: pnpm version consistency

- **WHEN** the Dockerfile installs pnpm
- **THEN** the pinned pnpm version SHALL match the `packageManager` field in root `package.json`

### Requirement: Backend Placement for Phase 1

Phase 1 of the migration SHALL model backend functionality as package(s) consumed by `apps/web`, not as a separate `apps/server` application.

#### Scenario: Backend remains package-based in phase 1

- **WHEN** backend modules are extracted from the current root layout
- **THEN** auth, DB, tRPC, queue, and startup modules SHALL be available via package exports
- **AND** `apps/web` SHALL import those package exports for runtime behavior
- **AND** the workspace SHALL not require a standalone `apps/server` process for phase-1 completion

### Requirement: Runtime Behavior Preservation During Migration

The phase-1 monorepo migration SHALL preserve the current single-deploy runtime behavior.

#### Scenario: Existing runtime features remain operational

- **WHEN** the migrated workspace is built and started
- **THEN** the web app SHALL continue to serve Next.js routes
- **AND** tRPC HTTP handlers SHALL remain available
- **AND** tRPC WebSocket initialization and startup jobs/workers SHALL remain operational in the single deploy flow

#### Scenario: Web build completes successfully

- **WHEN** `pnpm run build:web` is executed
- **THEN** the Next.js production build SHALL complete without module resolution errors
- **AND** all workspace package imports SHALL resolve via explicit `exports` map entries or barrel re-exports

### Requirement: Minimal Template Adoption

The monorepo SHALL adopt only the structural patterns from `turbo-norish` that Norish needs: composable tooling packages (`@norish/eslint-config`, `@norish/prettier-config`, `@norish/tsconfig`, `@norish/tailwind-config`), per-workspace script delegation, dependency catalog in `pnpm-workspace.yaml`, and composite GitHub Action for CI setup. Template-specific starter code, Expo/mobile scaffolding, and shadcn-ui theme tokens SHALL NOT be adopted.

#### Scenario: Tooling packages follow turbo-norish export conventions

- **WHEN** a workspace needs ESLint, Prettier, TypeScript, or Tailwind configuration
- **THEN** it imports from a `@norish/*` tooling package using the same export paths as `turbo-norish` (`@norish/eslint-config/base`, `@norish/prettier-config`, `@norish/tsconfig/base.json`, `@norish/tailwind-config/theme`)

#### Scenario: Norish-specific config is preserved

- **WHEN** adopting turbo-norish ESLint patterns
- **THEN** norish-specific rules (HeroUI JSX-A11y overrides, `padding-line-between-statements`, `react/jsx-sort-props`) are preserved in the base or app-level config

### Requirement: Root Manifest Is Workspace Control Plane

The root `package.json` SHALL contain only workspace orchestration concerns: Turbo, TypeScript, the shared Prettier config reference, and minimal CLI tools (`dotenv-cli`). All ESLint plugins, Prettier plugins, Vitest, jsdom, PostCSS, Tailwind, and other development dependencies SHALL be declared in the tooling workspace package that owns them. The root `devDependencies` list SHALL NOT exceed 6 entries after tooling package migration is complete.

#### Scenario: Root devDependencies audit after tooling migration

- **WHEN** `tooling/eslint/`, `tooling/prettier/`, `tooling/typescript/`, `tooling/tailwind/` are proper workspace packages
- **THEN** root `devDependencies` contains only `turbo`, `typescript`, `@norish/prettier-config`, and at most 3 orchestration tools
- **AND** all ESLint plugins, Prettier plugins, test frameworks, and CSS tooling are declared in their owning tooling package

#### Scenario: Root dependencies remain workspace links only

- **WHEN** inspecting root `package.json` `dependencies`
- **THEN** only `workspace:*` links to `@norish/*` packages are present

### Requirement: CI Build Excludes Mobile App

Continuous integration build commands SHALL exclude `@norish/mobile` from the Turborepo build pipeline since mobile builds are handled by Expo EAS, not turbo.

#### Scenario: Turbo build skips mobile in CI

- **WHEN** `turbo run build` is invoked in the CI environment
- **THEN** `@norish/mobile` SHALL NOT be included in the build task graph
- **AND** the build SHALL complete using only web and package workspaces

#### Scenario: Mobile has no turbo-compatible build script

- **WHEN** inspecting `apps/mobile/package.json`
- **THEN** there SHALL be no `build` script that turbo would attempt to execute
- **OR** the mobile workspace SHALL be excluded via turbo filter configuration

### Requirement: Package Export Maps Cover All Consumer Imports

Every subpath import used by `apps/web` or `apps/mobile` from a `packages/*` workspace SHALL be resolvable through the package's `exports` field or through a barrel re-export from an explicitly exported entry point.

#### Scenario: Shared-react hooks are importable by web and mobile

- **WHEN** `apps/web` or `apps/mobile` imports `createRecipeDetailContext` from `@norish/shared-react`
- **THEN** the import SHALL resolve through the `./hooks` barrel export (`@norish/shared-react/hooks`)
- **AND** deep subpath imports like `@norish/shared-react/hooks/recipe-detail` SHALL NOT be used unless explicitly listed in the `exports` map
