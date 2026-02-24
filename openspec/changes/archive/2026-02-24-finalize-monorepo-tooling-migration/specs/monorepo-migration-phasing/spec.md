## MODIFIED Requirements

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
