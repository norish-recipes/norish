## ADDED Requirements

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
