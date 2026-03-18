## MODIFIED Requirements

### Requirement: Workspace Dependency Declarations Are Authoritative

Every workspace SHALL declare all its direct dependencies in its own `package.json`. Tooling workspace packages (`@norish/eslint-config`, `@norish/prettier-config`, `@norish/tsconfig`, `@norish/tailwind-config`) SHALL own their plugin and tool dependencies. Consumer workspaces (apps and packages) SHALL reference tooling packages as `devDependencies` and SHALL NOT duplicate tooling package internals (e.g., ESLint plugins) in their own manifests.

#### Scenario: ESLint plugin ownership

- **WHEN** inspecting `tooling/eslint/package.json` dependencies
- **THEN** all ESLint plugins (`typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-turbo`, `@next/eslint-plugin-next`) are declared there
- **AND** no other workspace `package.json` directly depends on these plugins

#### Scenario: Consumer workspaces reference tooling packages

- **WHEN** inspecting any app or library package `package.json`
- **THEN** it lists `@norish/eslint-config`, `@norish/prettier-config`, and `@norish/tsconfig` as `devDependencies`
- **AND** does NOT duplicate the plugins those tooling packages provide

### Requirement: Temporary Root Exceptions Are Traceable and Reducible

After tooling package migration, the `temporaryShims` array in `root-hygiene-policy.json` SHALL be empty. Any remaining root devDependencies beyond the approved control-plane set SHALL have an explicit exception entry with `owner`, `rationale`, and `removeBy` date. The dependency workspace validation script SHALL verify that no workspace duplicates a dependency already provided transitively by a tooling package it consumes.

#### Scenario: Zero temporary shims after migration

- **WHEN** inspecting `root-hygiene-policy.json` after tooling migration
- **THEN** `temporaryShims` is an empty array

#### Scenario: Dependency catalog prevents version drift

- **WHEN** a shared dependency (TypeScript, ESLint, Prettier, Tailwind, Zod) is used across multiple workspaces
- **THEN** all workspaces use `catalog:` references in `pnpm-workspace.yaml` for version resolution
- **AND** no workspace hardcodes a version that conflicts with the catalog
