## MODIFIED Requirements

### Requirement: Root Manifest Is Workspace Control Plane

The root `package.json` SHALL contain only workspace orchestration concerns: Turbo, TypeScript, the shared Prettier config reference, and minimal CLI tools (`dotenv-cli`). All ESLint plugins, Prettier plugins, Vitest, jsdom, PostCSS, Tailwind, and other development dependencies SHALL be declared in the tooling workspace package that owns them. The root `devDependencies` list SHALL NOT exceed 6 entries after tooling package migration is complete.

#### Scenario: Root devDependencies audit after tooling migration

- **WHEN** `tooling/eslint/`, `tooling/prettier/`, `tooling/typescript/`, `tooling/tailwind/` are proper workspace packages
- **THEN** root `devDependencies` contains only `turbo`, `typescript`, `@norish/prettier-config`, and at most 3 orchestration tools
- **AND** all ESLint plugins, Prettier plugins, test frameworks, and CSS tooling are declared in their owning tooling package

#### Scenario: Root dependencies remain workspace links only

- **WHEN** inspecting root `package.json` `dependencies`
- **THEN** only `workspace:*` links to `@norish/*` packages are present

### Requirement: Minimal Template Adoption

The monorepo SHALL adopt only the structural patterns from `turbo-norish` that Norish needs: composable tooling packages (`@norish/eslint-config`, `@norish/prettier-config`, `@norish/tsconfig`, `@norish/tailwind-config`), per-workspace script delegation, dependency catalog in `pnpm-workspace.yaml`, and composite GitHub Action for CI setup. Template-specific starter code, Expo/mobile scaffolding, and shadcn-ui theme tokens SHALL NOT be adopted.

#### Scenario: Tooling packages follow turbo-norish export conventions

- **WHEN** a workspace needs ESLint, Prettier, TypeScript, or Tailwind configuration
- **THEN** it imports from a `@norish/*` tooling package using the same export paths as `turbo-norish` (`@norish/eslint-config/base`, `@norish/prettier-config`, `@norish/tsconfig/base.json`, `@norish/tailwind-config/theme`)

#### Scenario: Norish-specific config is preserved

- **WHEN** adopting turbo-norish ESLint patterns
- **THEN** norish-specific rules (HeroUI JSX-A11y overrides, `padding-line-between-statements`, `react/jsx-sort-props`) are preserved in the base or app-level config
