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

The migration SHALL only adopt Turborepo and t3-turbo patterns that are needed for Norish's current architecture.

#### Scenario: Non-required template parts are excluded

- **WHEN** workspace tooling and package layout are defined
- **THEN** only required tooling and package patterns SHALL be introduced
- **AND** template-specific technologies not currently used by Norish SHALL be excluded from the scope

### Requirement: Root Manifest Is Workspace Control Plane

The repository root manifest SHALL function as a workspace control plane and SHALL remain orchestration-focused rather than owning application/backend runtime dependency surfaces.

#### Scenario: Root manifest excludes workspace runtime libraries

- **WHEN** root `package.json` is reviewed during monorepo hardening
- **THEN** runtime libraries used by web/backend execution (for example framework, API/runtime SDKs, DB drivers, and queue runtimes) SHALL be declared in owning `apps/*` or `packages/*` manifests
- **AND** root `dependencies` SHALL remain limited to approved workspace-link/root-control-plane entries
- **AND** root `devDependencies` SHALL be limited to approved root tooling entries plus explicitly documented temporary exceptions tied to root-owned files.
