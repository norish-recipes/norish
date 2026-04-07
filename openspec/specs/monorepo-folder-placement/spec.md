# monorepo-folder-placement Specification

## Purpose

TBD - created by archiving change add-folder-by-folder-monorepo-plan. Update Purpose after archive.

## Requirements

### Requirement: Complete Root Folder Placement Coverage

Every top-level folder and file SHALL have a disposition: migrate, split, keep-root, generated, runtime-data, or remove. Tooling directories (`tooling/eslint/`, `tooling/prettier/`, `tooling/typescript/`, `tooling/vitest/`, `tooling/tailwind/`) SHALL be proper pnpm workspace packages with `package.json` and defined `exports`. The `tooling/github/` directory SHALL contain a composite GitHub Action for CI environment setup.

#### Scenario: Tooling directories are workspace packages

- **WHEN** running `pnpm ls --filter './tooling/*' --depth 0`
- **THEN** `@norish/eslint-config`, `@norish/prettier-config`, `@norish/tsconfig`, `@norish/tailwind-config` are listed as workspace packages

#### Scenario: Tooling github directory contains composite action

- **WHEN** inspecting `tooling/github/setup/action.yml`
- **THEN** the file defines a composite action that installs pnpm, sets up Node from `.nvmrc`, installs turbo, and runs `pnpm install`

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

The root directory SHALL contain only files and directories that serve monorepo-wide orchestration. After tooling package migration, the root file allowlist SHALL NOT include `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc`, `.prettierignore`, `tsconfig.server.json`, or `tsconfig.typecheck.json`. The `tsdown.config.ts` root shim SHALL be relocated to `apps/web/`. The `.nvmrc` file SHALL be added to the root allowlist for Node version pinning. Every file or dependency relocation SHALL atomically delete the source artifact in the same task step; no orphaned source files or stale root devDependencies SHALL remain after a phase validation gate.

#### Scenario: Temporary shims are removed after migration

- **WHEN** tooling packages are adopted by all workspaces
- **THEN** `eslint.config.mjs`, `vitest.config.ts`, and `tsdown.config.ts` no longer exist at root
- **AND** the `temporaryShims` array in `root-hygiene-policy.json` is empty

#### Scenario: Root allowlist reflects final state

- **WHEN** inspecting `allowedRootFiles` in `root-hygiene-policy.json`
- **THEN** it includes `.nvmrc`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `.gitignore`, `.npmrc`, `.dockerignore`, `.env.example`, `docker-compose.local.yml`, `AGENTS.md`, `CONTRIBUTING.md`, `LICENSE`, `README.md`
- **AND** it does NOT include `eslint.config.mjs`, `vitest.config.ts`, `tsdown.config.ts`, `.prettierrc`, `.prettierignore`, `tsconfig.server.json`, `tsconfig.typecheck.json`

#### Scenario: Move-and-prune enforcement at validation gates

- **WHEN** a phase validation gate runs after file or dependency relocations
- **THEN** no source artifact from any completed move exists at its original location
- **AND** no root devDependency that was moved to a workspace package remains in root `package.json`

### Requirement: Ownership-Based Script Placement

Every workspace SHALL declare its own `lint`, `format`, `typecheck`, and `clean` scripts in its `package.json`. Root scripts SHALL delegate to Turbo (`turbo run lint`, `turbo run format`, etc.) rather than invoking tools directly. Per-workspace ESLint configs SHALL compose from `@norish/eslint-config` exports. Per-workspace Prettier configs SHALL reference `@norish/prettier-config`. Per-workspace TypeScript configs SHALL extend `@norish/tsconfig`.

#### Scenario: Workspace scripts are self-contained

- **WHEN** running `turbo run lint` from root
- **THEN** each workspace runs its own `lint` script using its local `eslint.config.ts` that imports from `@norish/eslint-config`

#### Scenario: Workspace prettier delegation

- **WHEN** running `turbo run format` from root
- **THEN** each workspace runs its own `format` script and resolves its Prettier config from `@norish/prettier-config` via `"prettier"` field in `package.json`

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
