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

The root hygiene validation SHALL enforce that all tooling directories listed in `pnpm-workspace.yaml` under `tooling/*` are proper workspace packages (contain a `package.json` with a `name` field). The hygiene gate SHALL verify that root `devDependencies` count does not exceed the approved maximum (6 entries). The hygiene gate SHALL verify the `temporaryShims` array is empty after all shims have been removed.

#### Scenario: Tooling directories validated as workspace packages

- **WHEN** running `pnpm run hygiene:root`
- **THEN** the checker verifies each `tooling/*/package.json` exists and contains a valid package name
- **AND** the check fails if any tooling directory lacks a `package.json`

#### Scenario: Root devDependency count enforcement

- **WHEN** running `pnpm run hygiene:root`
- **THEN** the checker reports the root devDependency count
- **AND** the check fails if the count exceeds 6

### Requirement: Legacy Reference Retirement at Hardening Exit

After tooling migration completion, all references to legacy root config patterns SHALL be removed. This includes: root-relative path aliases in `tsconfig.json` for `@norish/*` packages (resolved via workspace linking instead), ESLint `FlatCompat` shims (replaced by native `typescript-eslint` flat config), root `.prettierrc`/`.prettierignore` files (replaced by `@norish/prettier-config` package), and root-level vitest config (replaced by workspace-local configs).

#### Scenario: No legacy ESLint compatibility shims remain

- **WHEN** searching for `FlatCompat` or `@eslint/compat` in any ESLint config
- **THEN** zero results are found (all configs use native flat config patterns)

#### Scenario: No root prettier config files remain

- **WHEN** listing root directory files
- **THEN** `.prettierrc` and `.prettierignore` are not present

### Requirement: Root Test Migration Uses Move-and-Prune

Hardening SHALL treat root `__tests__/**` as transitional and SHALL complete test ownership transfer using move-and-prune waves that eliminate migrated legacy root test paths.

#### Scenario: Root test migration wave removes legacy root copies

- **WHEN** root test files are moved to owning workspace test locations
- **THEN** the corresponding root `__tests__/**` files SHALL be deleted in the same migration wave
- **AND** empty legacy root test directories SHALL be removed
- **AND** hardening evidence SHALL report remaining root test file count and linked follow-up work until migration is complete.

### Requirement: Tooling Migration Phase B7 Includes Cycle Exit Gate

Phase B7 of tooling migration SHALL require a passing circular dependency gate before Phase C root-cleanup tasks may begin.

#### Scenario: B7 exit requires cycle and quality gates

- **WHEN** Phase B7 validation is executed
- **THEN** validation SHALL include `pnpm run deps:cycles`, `turbo run lint`, `turbo run typecheck`, `turbo run format`, `pnpm test:run`, and `pnpm build`
- **AND** B7 SHALL remain incomplete until all listed commands pass.

#### Scenario: Failed cycle gate blocks next phase

- **WHEN** `pnpm run deps:cycles` reports one or more cycles during B7
- **THEN** Phase C tasks SHALL be treated as blocked
- **AND** the migration plan SHALL add and complete explicit cycle-remediation tasks before Phase C proceeds.
