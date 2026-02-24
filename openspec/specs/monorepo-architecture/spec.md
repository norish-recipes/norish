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

