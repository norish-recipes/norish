## ADDED Requirements

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
