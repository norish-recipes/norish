## ADDED Requirements

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
