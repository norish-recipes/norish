# monorepo-migration-phasing Specification

## Purpose
TBD - created by archiving change add-folder-by-folder-monorepo-plan. Update Purpose after archive.
## Requirements
### Requirement: Ordered Multi-Phase Migration Roadmap

The monorepo migration SHALL be executed as an ordered phase roadmap with explicit objectives and prerequisite sequencing.

#### Scenario: Migration phases are explicitly defined and ordered

- **WHEN** migration planning is approved
- **THEN** the roadmap SHALL define at least these ordered phases: baseline alignment, workspace bootstrap, shared-boundary extraction, backend extraction, web relocation, operations cutover, and hardening
- **AND** no phase SHALL be marked complete while prerequisite phases remain incomplete

### Requirement: Phase Entry and Exit Gates

Each migration phase SHALL define objective entry prerequisites and exit validation gates.

#### Scenario: Phase completion is validated with repeatable checks

- **WHEN** a phase is proposed as complete
- **THEN** required validation commands for that phase SHALL be executed and recorded
- **AND** validation SHALL include static quality checks (lint, typecheck, tests, build) and dependency-cycle checks where applicable
- **AND** monorepo build SHALL pass for every phase exit
- **AND** runtime smoke tests for auth, tRPC HTTP/WS, and queue/startup flows SHALL be required before final migration sign-off, while intermediate phase deferrals SHALL be explicitly recorded in phase evidence

### Requirement: Folder-to-Phase Sequencing

The migration plan SHALL assign each top-level Norish folder to a primary migration phase, including split cases that span multiple phases.

#### Scenario: Folder movement waves are deterministic

- **WHEN** migration work is scheduled
- **THEN** each root folder SHALL have a primary phase assignment
- **AND** folders split across destinations SHALL include explicit sub-scope sequencing per phase
- **AND** phase assignments SHALL align with dependency constraints between shared, backend, web, and operations concerns

### Requirement: Phase 2 Move-and-Prune Cleanup

The shared-boundary extraction phase SHALL remove legacy root files as migrated package/app destinations become authoritative.

#### Scenario: Shared-boundary moves clear legacy root paths

- **WHEN** phase-2 migration scope moves modules from `types`, `config`, `i18n`, or `lib` into package/app destinations
- **THEN** migrated modules SHALL be deleted from their original root paths before phase-2 exit is approved
- **AND** phase evidence SHALL confirm no duplicate authoritative copies remain across legacy and destination paths
- **AND** any intentionally deferred legacy files SHALL be documented with rationale and a target follow-up phase

### Requirement: Phase 3 Move-and-Prune Cleanup

The backend extraction phase SHALL remove legacy root backend files as migrated package/app destinations become authoritative.

#### Scenario: Backend extraction clears legacy root paths

- **WHEN** phase-3 migration scope moves modules from `server/**` into backend packages and `apps/web/server/**`
- **THEN** migrated modules SHALL be deleted from their original root `server/**` paths before phase-3 exit is approved
- **AND** phase evidence SHALL confirm no duplicate authoritative backend copies remain across legacy and destination paths
- **AND** any intentionally deferred legacy backend files SHALL be documented with rationale and a target follow-up phase

### Requirement: Phase 4 Move-and-Prune Cleanup

The web relocation phase SHALL remove legacy root web files as migrated app/package destinations become authoritative.

#### Scenario: Web relocation clears legacy root paths

- **WHEN** phase-4 migration scope moves modules from `app`, `components`, `context`, `hooks`, `stores`, `styles`, or `public` into `apps/web` or related packages
- **THEN** migrated modules SHALL be deleted from their original root paths before phase-4 exit is approved
- **AND** phase evidence SHALL confirm no duplicate authoritative web copies remain across legacy and destination paths
- **AND** any intentionally deferred legacy web files SHALL be documented with rationale and a target follow-up phase

### Requirement: Rollback Checkpoints at Phase Boundaries

The migration SHALL define rollback checkpoints so failed phase exits can revert safely without discarding completed earlier phases.

#### Scenario: Phase validation failure triggers controlled rollback

- **WHEN** a phase fails its exit gate
- **THEN** the migration SHALL roll back to the most recent phase checkpoint
- **AND** the next phase SHALL not start until failing validation is resolved
- **AND** rollback procedure SHALL preserve evidence of the failed validation for follow-up

### Requirement: Root Hygiene Hardening Gate

Final monorepo hardening SHALL include a root hygiene gate that validates root manifest scope, explicit root file/directory placement allowlists, ownership-safe script routing, and install behavior settings against ownership-safe standards.

#### Scenario: Hardening completion requires clean root evidence

- **WHEN** the migration hardening phase is proposed as complete
- **THEN** validation SHALL confirm root `.npmrc` does not enable broad hoisting defaults that mask workspace ownership gaps
- **AND** validation SHALL confirm root manifest and root file/directory layout satisfy approved allowlists
- **AND** validation SHALL fail when root script implementations bypass ownership-aligned locations defined by `monorepo-folder-placement`
- **AND** any temporary exceptions SHALL be recorded with owner, expiry target, and linked follow-up migration work
- **AND** hardening evidence SHALL report temporary exception counts (before/current), root `__tests__` migration progress, and the remaining removal plan for unresolved exceptions.

### Requirement: Legacy Reference Retirement at Hardening Exit

Hardening completion SHALL retire stale pre-monorepo path references from validation scripts, build/typecheck include settings, and contributor-facing repository layout documentation.

#### Scenario: Legacy root paths are removed or explicitly tracked

- **WHEN** hardening exit evidence is assembled
- **THEN** dependency-cycle and typecheck/build validation inputs SHALL target active monorepo-owned paths only
- **AND** stale references to deprecated root source locations SHALL be removed or documented as temporary exceptions with owner and removal milestone
- **AND** contributor documentation SHALL describe the current `apps/*`, `packages/*`, and tooling ownership model used by the repository.

### Requirement: Root Test Migration Uses Move-and-Prune

Hardening SHALL treat root `__tests__/**` as transitional and SHALL complete test ownership transfer using move-and-prune waves that eliminate migrated legacy root test paths.

#### Scenario: Root test migration wave removes legacy root copies

- **WHEN** root test files are moved to owning workspace test locations
- **THEN** the corresponding root `__tests__/**` files SHALL be deleted in the same migration wave
- **AND** empty legacy root test directories SHALL be removed
- **AND** hardening evidence SHALL report remaining root test file count and linked follow-up work until migration is complete.

