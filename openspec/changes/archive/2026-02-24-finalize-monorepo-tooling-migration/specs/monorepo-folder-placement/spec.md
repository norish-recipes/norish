## MODIFIED Requirements

### Requirement: Complete Root Folder Placement Coverage

Every top-level folder and file SHALL have a disposition: migrate, split, keep-root, generated, runtime-data, or remove. Tooling directories (`tooling/eslint/`, `tooling/prettier/`, `tooling/typescript/`, `tooling/vitest/`, `tooling/tailwind/`) SHALL be proper pnpm workspace packages with `package.json` and defined `exports`. The `tooling/github/` directory SHALL contain a composite GitHub Action for CI environment setup.

#### Scenario: Tooling directories are workspace packages

- **WHEN** running `pnpm ls --filter './tooling/*' --depth 0`
- **THEN** `@norish/eslint-config`, `@norish/prettier-config`, `@norish/tsconfig`, `@norish/tailwind-config` are listed as workspace packages

#### Scenario: Tooling github directory contains composite action

- **WHEN** inspecting `tooling/github/setup/action.yml`
- **THEN** the file defines a composite action that installs pnpm, sets up Node from `.nvmrc`, installs turbo, and runs `pnpm install`

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
