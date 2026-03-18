## Phase A: Tooling Package Scaffolding

### A1. Dependency Catalog Setup

- [x] A1.1 Add `catalog:` section to `pnpm-workspace.yaml` with shared versions for: TypeScript, ESLint, Prettier, Tailwind CSS, PostCSS, Zod, Vite/Vitest, React types, and other cross-workspace dependencies. Reference turbo-norish's catalog as starting point, adjusted for norish's actual versions.
- [x] A1.2 Add `.nvmrc` to root directory pinning Node `24.13.1` (matching CI's `NODE_JS_VERSION`).
- [x] A1.3 Update `pnpm-workspace.yaml` `onlyBuiltDependencies` to include any missing native modules.

### A2. ESLint Tooling Package

- [x] A2.1 Create `tooling/eslint/package.json` for `@norish/eslint-config` with exports `./base`, `./react`, `./nextjs`. Move all ESLint plugins from root devDependencies to this package's dependencies.
- [x] A2.2 Create `tooling/eslint/tsconfig.json` extending `@norish/tsconfig/base.json`.
- [x] A2.3 Refactor `tooling/eslint/eslint.config.mjs` into three modular configs:
  - `base.ts`: Core TypeScript + import rules + norish-specific rules (`padding-line-between-statements`, `no-console`, unused-imports). Uses native `typescript-eslint` instead of `FlatCompat`. Exports `restrictEnvAccess` config.
  - `react.ts`: React plugin + hooks + JSX-A11y + `react/jsx-sort-props` + `react/self-closing-comp`.
  - `nextjs.ts`: `@next/eslint-plugin-next` recommended + core-web-vitals.
- [x] A2.4 Delete the old `tooling/eslint/eslint.config.mjs` after modular configs are in place.

### A3. Prettier Tooling Package

- [x] A3.1 Create `tooling/prettier/` directory with `package.json` for `@norish/prettier-config` exporting `"."` -> `./index.js`.
- [x] A3.2 Create `tooling/prettier/index.js` with shared config: `@ianvs/prettier-plugin-sort-imports` (import ordering with `@norish` grouping) + `prettier-plugin-tailwindcss` (`cn`, `cva`, `clsx` functions). Preserve norish-specific settings: `printWidth: 100`, `trailingComma: "es5"`, `singleQuote: false`.
- [x] A3.3 Create `tooling/prettier/tsconfig.json` extending `@norish/tsconfig/base.json`.

### A4. TypeScript Tooling Package

- [x] A4.1 Create `tooling/typescript/` directory with `package.json` for `@norish/tsconfig` (`files: ["*.json"]`, no build step).
- [x] A4.2 Create `tooling/typescript/base.json` with shared strict settings: `ES2022` target, `strict: true`, `noUncheckedIndexedAccess: true`, `module: "Preserve"`, `moduleResolution: "Bundler"`, `incremental: true`, `noEmit: true`. Reference turbo-norish's base.json but preserve norish-needed options.
- [x] A4.3 Create `tooling/typescript/compiled-package.json` extending base, enabling `declaration`, `declarationMap`, `emitDeclarationOnly`, `outDir: "${configDir}/dist"`.

### A5. Tailwind Tooling Package

- [x] A5.1 Create `tooling/tailwind/package.json` for `@norish/tailwind-config` with exports `./theme` -> `./theme.css`, `./postcss-config` -> `./postcss-config.js`, `./hero` -> `./hero.ts`.
- [x] A5.2 Create `tooling/tailwind/postcss-config.js` exporting `{ plugins: { "@tailwindcss/postcss": {} } }`.
- [x] A5.3 Move `@tailwindcss/postcss`, `postcss`, and `tailwindcss` from root devDeps to this package's dependencies. Delete these entries from root `package.json` devDependencies in the same step (move-and-prune: D8).
- [x] A5.4 Create `tooling/tailwind/tsconfig.json` extending `@norish/tsconfig/base.json`.

### A6. CI Composite Action

- [x] A6.1 Create `tooling/github/setup/action.yml` composite action: install pnpm (`pnpm/action-setup@v4`), setup Node (from `.nvmrc`), global install turbo, run `pnpm install`.
- [x] A6.2 Add `tooling/github/` to `allowedRootDirectories` in hygiene policy (it's under `tooling/` already, just ensure coverage).

### A7. Phase A Validation

- [x] A7.1 Run `pnpm install` and verify all tooling packages are recognized as workspace packages.
- [x] A7.2 Verify `pnpm ls --filter './tooling/*' --depth 0` shows all 4 tooling packages.

## Phase B: Config Conversion and Workspace Adoption

### B1. Per-Workspace ESLint Adoption

- [x] B1.1 Create `eslint.config.ts` in `apps/web/` composing `baseConfig`, `reactConfig`, `nextjsConfig`, and `restrictEnvAccess` from `@norish/eslint-config`.
- [x] B1.2 Create `eslint.config.ts` in each library package (`packages/api`, `packages/auth`, `packages/config`, `packages/db`, `packages/i18n`, `packages/queue`, `packages/shared`, `packages/ui`) composing `baseConfig` (and `reactConfig` for UI package).
- [x] B1.3 Add `lint` script to each workspace `package.json`: `eslint` (with `--flag unstable_native_nodejs_ts_config` if needed for `.ts` config files).
- [x] B1.4 Add `@norish/eslint-config` as devDependency to each workspace.

### B2. Per-Workspace Prettier Adoption

- [x] B2.1 Add `"prettier": "@norish/prettier-config"` to each workspace `package.json`.
- [x] B2.2 Add `format` script to each workspace `package.json`: `prettier --check . --ignore-path ../../.gitignore`.
- [x] B2.3 Add `@norish/prettier-config` as devDependency to each workspace.

### B3. Per-Workspace TypeScript Adoption

- [x] B3.1 Update `apps/web/tsconfig.json` to extend `@norish/tsconfig/base.json`, adding only web-specific options (`dom` lib, JSX, `~/` path alias). Remove all `@norish/*` path aliases.
- [x] B3.2 Update each library package `tsconfig.json` to extend `@norish/tsconfig/compiled-package.json` (for packages that emit types) or `@norish/tsconfig/base.json` (for non-emitting packages like `ui`).
- [x] B3.3 Add `typecheck` script to each workspace `package.json`: `tsc --noEmit`.
- [x] B3.4 Add `@norish/tsconfig` as devDependency to each workspace.

### B4. Per-Workspace Tailwind Adoption

- [x] B4.1 Update `apps/web/postcss.config.js` to re-export from `@norish/tailwind-config/postcss-config` (or keep inline since it's one line).
- [x] B4.2 Update `apps/web` CSS imports to reference `@norish/tailwind-config/theme`.
- [x] B4.3 Add `@norish/tailwind-config` as devDependency to `apps/web`.

### B5. Vitest Migration to Workspace-Local Configs

- [x] B5.1 Create `apps/web/vitest.config.ts` with jsdom environment, React plugin, workspace-local path aliases, and reference to `apps/web/__tests__/setup.ts`.
- [x] B5.2 Move `tooling/vitest/setup.ts` to `apps/web/__tests__/setup.ts` (or appropriate test setup location). Delete the original `tooling/vitest/setup.ts` in the same step (move-and-prune: D8).
- [x] B5.3 For any packages with tests (`packages/db`, `packages/api`, `packages/shared`), create per-package `vitest.config.ts` with appropriate environment (node for db/api, jsdom for shared if needed).
- [x] B5.4 Add `test` script to each workspace that has tests.

### B6. Per-Workspace Clean Script

- [x] B6.1 Add `clean` script to each workspace: `git clean -xdf .cache .turbo node_modules dist`.

### B7. Phase B Validation

- [x] B7.1 Run `pnpm run deps:cycles` and verify zero cycles.
- [x] B7.2 Run `turbo run lint` and verify all workspaces lint successfully.
- [x] B7.3 Run `turbo run typecheck` and verify all workspaces typecheck.
- [x] B7.4 Run `turbo run format` and verify formatting checks pass.
- [x] B7.5 Run `pnpm test:run` and verify all tests pass.
- [x] B7.6 Run `pnpm build` and verify build succeeds.

Phase C tasks are blocked until B7.1-B7.6 are all green.

## Phase C: Root Cleanup

### C1. Root Shim Removal

- [x] C1.1 Delete `eslint.config.mjs` from root (no longer needed; Turbo delegates to per-workspace configs).
- [x] C1.2 Delete `vitest.config.ts` from root (replaced by workspace-local configs).
- [x] C1.3 Move `tsdown.config.ts` from root to `apps/web/tsdown.config.ts` and update `apps/web/package.json` `build:server` script. Delete the root `tsdown.config.ts` in the same step (move-and-prune: D8).
- [x] C1.4 Delete `tsconfig.server.json` from root (server build config moves into `apps/web/` scope).
- [x] C1.5 Delete `tsconfig.typecheck.json` from root (typecheck now runs per-workspace).
- [x] C1.6 Delete `.prettierrc` and `.prettierignore` from root (replaced by `@norish/prettier-config` package and per-workspace scripts).

### C2. Root `package.json` Slimming

- [x] C2.1 Remove all ESLint plugins, ESLint compat packages, and ESLint parser from root devDependencies.
- [x] C2.2 Remove `prettier`, `prettier-plugin-tailwindcss` from root devDependencies (now in `@norish/prettier-config`).
- [x] C2.3 Remove `vitest`, `@vitejs/plugin-react`, `jsdom` from root devDependencies (now in workspace-local configs).
- [x] C2.4 Remove `postcss`, `tailwindcss`, `@tailwindcss/postcss` from root devDependencies (now in `@norish/tailwind-config`).
- [x] C2.5 Remove `globals` from root devDependencies (now in `@norish/eslint-config`).
- [x] C2.6 Move `drizzle-kit` from root devDependencies to `packages/db` devDependencies. Remove `drizzle-kit` from root `package.json` devDependencies in the same step (move-and-prune: D8).
- [x] C2.7 Evaluate `tsx`, `cross-env`, and `tsdown` -- move to owning workspaces if not needed at root. For each dependency moved, remove it from root devDependencies in the same step (move-and-prune: D8).
- [x] C2.8 Add `@norish/prettier-config` as root devDependency for root-level `prettier` field.
- [x] C2.9 Update root scripts to use Turbo delegation: `"lint": "turbo run lint"`, `"format": "turbo run format"`, `"typecheck": "turbo run typecheck"`, etc.
- [x] C2.10 Convert shared dependency versions to `catalog:` references where applicable.

### C3. Root TypeScript Config Simplification

- [x] C3.1 Simplify root `tsconfig.json` to extend `@norish/tsconfig/base.json` and add only root-level includes. Remove all `@norish/*` path aliases (resolved via workspace linking). Keep `next` plugin reference.
- [x] C3.2 Remove root `tsconfig.tsbuildinfo` and `tsconfig.typecheck.tsbuildinfo` from tracking (generated files).

### C4. Turbo Configuration Enhancement

- [x] C4.1 Update `turbo.json` to add `globalEnv` for norish-specific env vars (`DATABASE_URL`, `MASTER_KEY`, `AUTH_URL`, `CHROME_WS_ENDPOINT`, `REDIS_URL`).
- [x] C4.2 Add `globalPassThroughEnv` for `NODE_ENV`, `CI`, `npm_lifecycle_event`.
- [x] C4.3 Add `topo` task for dependency ordering.
- [x] C4.4 Add caching configuration: `outputs` for `.cache/` directories, `outputLogs: "new-only"` for format task.
- [x] C4.5 Add `apps/web/turbo.json` extending root with `.next/**` build outputs and `persistent: true` dev.

### C5. Hygiene Policy Update

- [x] C5.1 Remove `eslint.config.mjs`, `vitest.config.ts`, `tsdown.config.ts`, `.prettierrc`, `.prettierignore`, `tsconfig.server.json`, `tsconfig.typecheck.json` from `allowedRootFiles`.
- [x] C5.2 Add `.nvmrc` to `allowedRootFiles`.
- [x] C5.3 Clear the `temporaryShims` array.
- [x] C5.4 Remove all ESLint plugin/compat/parser entries from `allowedRootDevDependencies`.
- [x] C5.5 Remove `prettier`, `prettier-plugin-tailwindcss`, `vitest`, `@vitejs/plugin-react`, `jsdom`, `postcss`, `tailwindcss`, `@tailwindcss/postcss`, `globals`, `drizzle-kit` from `allowedRootDevDependencies`.
- [x] C5.6 Add `@norish/prettier-config` and `dotenv-cli` to `allowedRootDevDependencies` (if used at root).
- [x] C5.7 Add validation for tooling workspace package existence (each `tooling/*/package.json` must exist).

### C6. Phase C Validation

- [x] C6.1 Run `pnpm install` from clean state.
- [x] C6.2 Run `pnpm run hygiene:root` and verify pass.
- [x] C6.3 Run `pnpm run deps:workspace` and verify pass.
- [x] C6.4 Run `turbo run lint`, `turbo run typecheck`, `turbo run format`, `pnpm test:run`, `pnpm build`.
- [x] C6.5 Run `pnpm run deps:cycles` and verify zero cycles.

## Phase D: CI and Documentation Alignment

### D1. CI Workflow Updates

- [x] D1.1 Update `.github/workflows/pr-quality.yml` to use `tooling/github/setup` composite action for all jobs.
- [x] D1.2 Update CI lint job to use `turbo run lint` instead of direct `eslint` invocation.
- [x] D1.3 Update CI format job to use `turbo run format` instead of direct `prettier` invocation.
- [x] D1.4 Update CI typecheck job to use `turbo run typecheck` instead of direct `tsc` invocation.
- [x] D1.5 Update CI test job to use `turbo run test` with appropriate filtering.
- [x] D1.6 Update `.github/workflows/release-build.yml` and `rc-release-build.yml` to use composite action.
- [x] D1.7 Update `.github/workflows/docker-build-test.yml` to use composite action.

### D2. Documentation Updates

- [x] D2.1 Update `CONTRIBUTING.md` to document the tooling package structure and how to add new configs.
- [x] D2.2 Update `AGENTS.md` if it references root config file locations.

### D3. Cleanup Stray Tooling Artifacts

- [x] D3.1 Remove `tooling/vitest/` directory entirely (setup.ts already moved in B5.2; config is per-workspace; delete any remaining files and the directory itself).
- [x] D3.2 Verify no workspace references old root config paths (`../../eslint.config.mjs`, `../../vitest.config.ts`, etc.).

### D4. Final Validation

- [x] D4.1 Run full quality gate: `pnpm run hygiene:root`, `pnpm run deps:workspace`, `pnpm run deps:cycles`, `turbo run lint`, `turbo run typecheck`, `turbo run format`, `pnpm test:run`, `pnpm build`.
- [x] D4.2 Verify root devDependencies count is 6 or fewer.
- [x] D4.3 Verify `temporaryShims` array in `root-hygiene-policy.json` is empty.
- [x] D4.4 Run `openspec validate finalize-monorepo-tooling-migration --strict --no-interactive`.

## Dependencies and Parallelism Notes

- **Move-and-prune policy (D8):** Every task that relocates a file or dependency MUST delete the source artifact in the same task step. Tasks tagged `(move-and-prune: D8)` are subject to this rule. After each phase validation gate, no orphaned source artifacts from that phase's moves may remain.
- **Phase A** is prerequisite for Phase B (tooling packages must exist before workspaces can reference them).
- Within Phase A: A2, A3, A4, A5 can run in parallel after A1 (catalog setup).
- Within Phase A: A6 is independent and can run in parallel with A2-A5.
- **Phase B** depends on Phase A completion.
- Within Phase B: B1, B2, B3, B4, B5, B6 can run in parallel (per-workspace adoption is independent per concern).
- **Phase C** depends on Phase B validation passing (confirms per-workspace configs work before removing root shims).
- Within Phase C: C1, C2 must complete before C5 (hygiene policy references the files being removed). C3 and C4 can run in parallel with C1/C2.
- **Phase D** depends on Phase C (CI updates reference the new Turbo-delegated scripts). D1 and D2 can run in parallel.
