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

The workspace SHALL enforce one-way dependency direction so shared contracts never import backend internals and backend code never depends on app-specific modules.

#### Scenario: Import direction remains valid after extraction

- **WHEN** modules are moved to `apps/*` and `packages/*`
- **THEN** shared package(s) SHALL only depend on other shared/runtime-safe modules
- **AND** backend package(s) MAY depend on shared package(s)
- **AND** backend package(s) SHALL NOT import from `apps/web`

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

Each `apps/*` and `packages/*` workspace SHALL explicitly declare every direct dependency it imports or executes for runtime, build, test, and lint flows, and SHALL NOT rely on root-level fallback declarations.

#### Scenario: Undeclared direct dependency fails validation

- **WHEN** workspace dependency validation runs
- **THEN** any app/package importing a module not declared in its own manifest SHALL fail validation
- **AND** remediation SHALL add the dependency to the owning workspace manifest instead of root `package.json`.

### Requirement: Temporary Root Exceptions Are Traceable and Reducible

Any root dependency exception used during migration hardening SHALL be treated as temporary policy debt, SHALL be traceable to active root-owned usage, and SHALL include concrete removal work needed to eliminate the exception.

#### Scenario: Exception metadata proves active need and planned removal

- **WHEN** root dependency exception policy is validated
- **THEN** each temporary exception SHALL include owner, rationale, and target removal milestone
- **AND** each temporary exception SHALL reference one or more active root-owned files that currently require it
- **AND** exceptions justified by root `__tests__/**` usage SHALL include the mapped owning workspace destination for those tests
- **AND** each temporary exception SHALL link to tracked migration work that removes the cited root-owned usage
- **AND** exceptions tied only to tests/helpers that have been migrated into owning workspaces SHALL be removed from root manifest/policy allowlists in that migration wave
- **AND** exceptions without active root-owned usage SHALL be removed from root manifest/policy allowlists.

