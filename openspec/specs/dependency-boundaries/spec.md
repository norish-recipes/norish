# dependency-boundaries Specification

## Purpose

TBD - created by archiving change refactor-turborepo-monorepo-foundation. Update Purpose after archive.

## Requirements

### Requirement: Circular Dependency Baseline and Remediation

The migration SHALL start from an explicit circular dependency baseline and remove all detected circular imports before finalizing workspace extraction.

#### Scenario: Circular dependency inventory is established and resolved

- **WHEN** migration work begins
- **THEN** the team SHALL capture a machine-readable circular dependency report for the current codebase
- **AND** each detected cycle SHALL be mapped to a remediation action
- **AND** extraction of modules into workspace packages SHALL not be considered complete until the cycle report is clean

### Requirement: Enforced Dependency Direction Between Layers

The workspace SHALL enforce one-way dependency direction so shared contracts never import backend internals and backend code never depends on app-specific modules. For the TRPC/API boundary, `@norish/api` MAY depend on `@norish/trpc`, and `@norish/trpc` SHALL NOT depend on `@norish/api`. Infrastructure consumers (`@norish/queue`, `@norish/auth`) SHALL import reusable server infrastructure from `@norish/shared-server` rather than from `@norish/api`.

#### Scenario: Import direction remains valid after extraction

- **WHEN** modules are moved to `apps/*` and `packages/*`
- **THEN** shared package(s) SHALL only depend on other shared/runtime-safe modules
- **AND** backend package(s) MAY depend on shared package(s)
- **AND** backend package(s) SHALL NOT import from `apps/web`

#### Scenario: TRPC to API dependency back-edge is prevented

- **WHEN** package dependency validation runs for the workspace
- **THEN** `@norish/api` MAY import from `@norish/trpc`
- **AND** `@norish/trpc` SHALL NOT import from `@norish/api`
- **AND** boundary compliance SHALL preserve the model where API hosts routes and TRPC owns router/contracts

#### Scenario: Infrastructure imports flow through shared-server not api

- **WHEN** `@norish/queue` or `@norish/auth` needs server infrastructure (logger, media storage, AI foundations)
- **THEN** these packages SHALL import from `@norish/shared-server`
- **AND** these packages SHALL NOT import infrastructure modules from `@norish/api` when an equivalent export exists in `@norish/shared-server`
- **AND** `@norish/queue` MAY still import domain-specific modules from `@norish/api` (e.g., AI features, parser, video) that are not available in `@norish/shared-server`

### Requirement: Remove Barrel-Based Cross-Layer Coupling

The migration SHALL replace broad barrel imports that currently route through server-derived DTO exports and create cross-layer cycles.

#### Scenario: Cycle-prone barrels are replaced with scoped imports

- **WHEN** type and DTO imports are refactored
- **THEN** imports SHALL use scoped module paths that respect package boundaries
- **AND** shared type surfaces SHALL not derive from backend-only schema modules
- **AND** self-referential barrel imports SHALL be removed

### Requirement: Dependency Validation Gate

The repository SHALL provide automated validation that fails when circular dependencies or boundary violations are reintroduced.

#### Scenario: CI fails on cycle regressions

- **WHEN** pull request validation runs
- **THEN** automated dependency checks SHALL run alongside build/test/lint/typecheck
- **AND** any detected circular dependency SHALL fail validation

### Requirement: Workspace Dependency Declarations Are Authoritative

Every workspace SHALL declare all its direct dependencies in its own `package.json`. Tooling workspace packages (`@norish/eslint-config`, `@norish/prettier-config`, `@norish/tsconfig`, `@norish/tailwind-config`) SHALL own their plugin and tool dependencies. Consumer workspaces (apps and packages) SHALL reference tooling packages as `devDependencies` and SHALL NOT duplicate tooling package internals (e.g., ESLint plugins) in their own manifests.

#### Scenario: ESLint plugin ownership

- **WHEN** inspecting `tooling/eslint/package.json` dependencies
- **THEN** all ESLint plugins (`typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-turbo`, `@next/eslint-plugin-next`) are declared there
- **AND** no other workspace `package.json` directly depends on these plugins

#### Scenario: Consumer workspaces reference tooling packages

- **WHEN** inspecting any app or library package `package.json`
- **THEN** it lists `@norish/eslint-config`, `@norish/prettier-config`, and `@norish/tsconfig` as `devDependencies`
- **AND** does NOT duplicate the plugins those tooling packages provide

### Requirement: Temporary Root Exceptions Are Traceable and Reducible

After tooling package migration, the `temporaryShims` array in `root-hygiene-policy.json` SHALL be empty. Any remaining root devDependencies beyond the approved control-plane set SHALL have an explicit exception entry with `owner`, `rationale`, and `removeBy` date. The dependency workspace validation script SHALL verify that no workspace duplicates a dependency already provided transitively by a tooling package it consumes.

#### Scenario: Zero temporary shims after migration

- **WHEN** inspecting `root-hygiene-policy.json` after tooling migration
- **THEN** `temporaryShims` is an empty array

#### Scenario: Dependency catalog prevents version drift

- **WHEN** a shared dependency (TypeScript, ESLint, Prettier, Tailwind, Zod) is used across multiple workspaces
- **THEN** all workspaces use `catalog:` references in `pnpm-workspace.yaml` for version resolution
- **AND** no workspace hardcodes a version that conflicts with the catalog

### Requirement: Repository Modules Preserve One-Way Infrastructure Dependencies

Database repository modules SHALL remain infrastructure-layer modules and SHALL NOT import service-layer entry points from sibling domains (for example `@norish/auth/*`, `@norish/api/*`, or `@norish/config/server-config-loader`).

#### Scenario: Repository import graph avoids service-layer back edges

- **WHEN** a repository module under `packages/db/src/repositories/**` is inspected
- **THEN** its imports SHALL be limited to database schema, drizzle access, shared contracts/utilities, and sibling repository helpers
- **AND** it SHALL NOT import service-layer modules that themselves depend on configuration or repository aggregation.

### Requirement: Config Loaders Use Scoped Repository Access

Configuration loader modules SHALL import only the specific repository module(s) required for config persistence and SHALL NOT depend on broad repository barrels that aggregate unrelated repository concerns.

#### Scenario: Server config loader avoids repository barrel fan-in

- **WHEN** `packages/config/src/server-config-loader.ts` reads or writes server config values
- **THEN** it SHALL use scoped imports for server-config data access
- **AND** it SHALL NOT import `@norish/db/repositories` barrel exports.
