## MODIFIED Requirements

### Requirement: Root File Allowlist and Wrapper Pruning

Post-migration cleanup SHALL maintain explicit root-level allowlists for both files and directories so root ownership remains intentional, while workspace-specific configuration lives with owning workspaces and legacy root wrappers are pruned or explicitly time-boxed.

#### Scenario: Root wrappers are removed or tracked

- **WHEN** root placement is reviewed for migration hardening
- **THEN** every root file and directory SHALL match an approved allowlist entry with defined ownership intent
- **AND** duplicate/pass-through root wrapper files for workspace-owned configs SHALL be moved, removed, or converted into documented temporary shims
- **AND** each temporary shim SHALL record an owner, rationale, and target removal milestone.

#### Scenario: Non-config root clutter is rejected

- **WHEN** root hygiene validation scans repository root entries
- **THEN** unallowlisted root files or directories (including non-config artifacts) SHALL fail validation
- **AND** remediation SHALL either move the entry into an owning workspace/tooling location or add an explicitly justified temporary exception.

## ADDED Requirements

### Requirement: Ownership-Based Script Placement

Script implementations SHALL be stored in ownership-aligned locations so root command wiring remains orchestration-only and script maintenance follows workspace ownership boundaries.

#### Scenario: Script implementations are placed by owner

- **WHEN** script placement is reviewed during hardening
- **THEN** monorepo control scripts SHALL live under `tooling/monorepo/scripts/*`
- **AND** app-specific scripts SHALL live under `apps/*/scripts/*`
- **AND** package-specific scripts SHALL live under `packages/*/scripts/*`
- **AND** root `package.json` scripts SHALL orchestrate or delegate to these owned script locations instead of hosting package-specific script implementations.

### Requirement: Root Test Ownership Migration and Pruning

Root `__tests__/**` content SHALL be migrated into owning workspace test locations, and migrated root test paths SHALL be deleted so root is not an authoritative long-term test source.

#### Scenario: Root tests are moved to owning workspaces

- **WHEN** root test ownership migration is executed
- **THEN** each root `__tests__/**` file SHALL be mapped to an owning `apps/*` or `packages/*` workspace
- **AND** migrated tests/helpers SHALL be placed in the owning workspace's test location.

#### Scenario: Legacy root test paths are removed during migration

- **WHEN** a root test migration wave completes
- **THEN** migrated root test files SHALL be deleted from the root `__tests__/**` tree in the same wave
- **AND** empty legacy directories under root `__tests__/` SHALL be removed
- **AND** root hygiene policy and dependency exception tracking SHALL be updated to reflect the new ownership.
