# monorepo-folder-placement Specification

## Purpose
TBD - created by archiving change add-folder-by-folder-monorepo-plan. Update Purpose after archive.
## Requirements
### Requirement: Complete Root Folder Placement Coverage

The monorepo migration plan SHALL define an explicit destination or disposition for every top-level Norish folder, including source, generated, runtime-data, and operations folders.

#### Scenario: All root folders are accounted for in planning

- **WHEN** the folder placement plan is reviewed
- **THEN** it SHALL include entries for `.github`, `.vscode`, `__tests__`, `app`, `components`, `config`, `context`, `dist-server`, `docker`, `hooks`, `i18n`, `lib`, `node_modules`, `openspec`, `public`, `scripts`, `server`, `stores`, `styles`, `tooling`, `types`, `uploads`, `yt-dlp`, and `.next`
- **AND** each entry SHALL be labeled with one disposition category: `migrate`, `split`, `keep-root`, `generated`, `runtime-data`, or `remove`

### Requirement: Canonical Destination Rules for Product Source Folders

The plan SHALL define canonical destination rules so source folders are migrated consistently into `apps/*` and `packages/*` without ad-hoc placement.

#### Scenario: Product folders map to stable monorepo targets

- **WHEN** source code folders are migrated
- **THEN** `app`, `components`, `context`, `hooks`, `stores`, `styles`, and `public` modules SHALL be placed under `apps/web`
- **AND** shared `i18n` catalogs/helpers SHALL be placed in `packages/i18n`, with app runtime adapter modules remaining in `apps/web`
- **AND** backend modules from `server` and server-side portions of `config` and `lib` SHALL be placed under backend packages in `packages/*`
- **AND** cross-runtime contracts from `types` SHALL be placed in shared package(s) that do not import backend internals
- **AND** DTO-defining Zod schemas (currently in `server/db/zodSchemas/`) that serve as the single source of truth for shared contract types SHALL be co-located in the shared package alongside their inferred TypeScript types, so that DTO types remain `z.output<>` derivations rather than manually duplicated interfaces
- **AND** backend-only runtime types (for example queue/job contracts coupled to backend libraries) SHALL remain in their owning backend package(s) and SHALL NOT be moved into shared contracts

### Requirement: Explicit Handling for Generated and Runtime-Data Folders

The plan SHALL explicitly distinguish generated artifacts and runtime data from migratable source code.

#### Scenario: Generated and runtime folders are not treated as source moves

- **WHEN** migration execution scope is defined
- **THEN** `node_modules`, `.next`, and `dist-server` SHALL be treated as generated outputs
- **AND** `uploads` and `yt-dlp` SHALL be treated as runtime data/binary provisioning concerns
- **AND** these folders SHALL not be used as direct source-of-truth inputs for package extraction

### Requirement: Template Placeholder Replacement Policy

The migration plan SHALL define how `turbo-norish` placeholder source code is replaced by Norish production implementation.

#### Scenario: Template scaffolding is retained without template behavior

- **WHEN** workspace scaffolding is imported from `turbo-norish`
- **THEN** starter placeholder source modules SHALL be replaced before phase completion
- **AND** only workspace/tooling patterns needed for Norish SHALL be retained
- **AND** any intentionally retained placeholder SHALL be tracked with explicit follow-up tasks

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

