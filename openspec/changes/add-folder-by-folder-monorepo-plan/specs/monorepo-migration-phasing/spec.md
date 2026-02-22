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
- **AND** phases affecting runtime behavior SHALL include smoke tests for auth, tRPC HTTP/WS, and queue/startup flows

### Requirement: Folder-to-Phase Sequencing

The migration plan SHALL assign each top-level Norish folder to a primary migration phase, including split cases that span multiple phases.

#### Scenario: Folder movement waves are deterministic

- **WHEN** migration work is scheduled
- **THEN** each root folder SHALL have a primary phase assignment
- **AND** folders split across destinations SHALL include explicit sub-scope sequencing per phase
- **AND** phase assignments SHALL align with dependency constraints between shared, backend, web, and operations concerns

### Requirement: Rollback Checkpoints at Phase Boundaries

The migration SHALL define rollback checkpoints so failed phase exits can revert safely without discarding completed earlier phases.

#### Scenario: Phase validation failure triggers controlled rollback

- **WHEN** a phase fails its exit gate
- **THEN** the migration SHALL roll back to the most recent phase checkpoint
- **AND** the next phase SHALL not start until failing validation is resolved
- **AND** rollback procedure SHALL preserve evidence of the failed validation for follow-up
