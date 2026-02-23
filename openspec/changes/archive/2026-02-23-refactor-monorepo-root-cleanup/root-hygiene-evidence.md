# Root Hygiene Evidence

## 1) Baseline and Ownership Mapping

### 1.1 Baseline (Before)

- Root dependencies: `66` total (`57` third-party + `9` workspace entries)
- Root devDependencies: `46`
- Root config wrappers present: `next.config.js`, `postcss.config.js`, `eslint.config.mjs`, `vitest.config.ts`, `tsdown.config.ts`
- Root `.npmrc` baseline:
  - `shamefully-hoist=true`
  - `strict-peer-dependencies=false`

### 1.1 Baseline (After)

- Root dependencies: `9` total (`0` third-party + `9` workspace entries)
- Root devDependencies: `47` (tooling + explicitly tracked temporary test-harness exceptions)
- Root wrapper reduction:
  - Removed: `next.config.js`, `postcss.config.js`
  - Remaining temporary shims: `eslint.config.mjs`, `vitest.config.ts`, `tsdown.config.ts`

### 1.2 Approved Root Allowlists

- Root dependency/devDependency allowlists: `tooling/monorepo/root-hygiene-policy.json`
- Root config allowlist and forbidden file list: `tooling/monorepo/root-hygiene-policy.json`
- Dependency exceptions and temporary shim metadata (owner/rationale/removal milestone): `tooling/monorepo/root-hygiene-policy.json`

### 1.3 Workspace Ownership Map

- `apps/web` owns app runtime/developer dependencies (`next`, `react`, `next-intl`, `@heroui/*`, `@tanstack/*`, `@trpc/client`, etc.)
- `packages/api` owns backend runtime/tooling dependencies (`@ai-sdk/*`, `ai`, `openai`, `playwright-*`, `bullmq`, `sharp`, etc.)
- `packages/auth` owns auth/runtime dependencies (`better-auth`, `next`, and internal workspace deps)
- `packages/db` owns db/data dependencies (`drizzle-orm`, `pg`, `zod`, `fuse.js`, `drizzle-kit`)
- `packages/queue` owns queue/runtime dependencies (`bullmq`, `ioredis`, `drizzle-orm`, `date-fns`, `superjson`)
- `packages/shared` owns shared runtime dependencies (`drizzle-zod`, `fraction.js`, `jsonrepair`, `parse-ingredient`, etc.)
- `packages/config` owns config/runtime dependencies (`dotenv`, `server-only`, `zod`)

## 2) Root Manifest Slimming

- Root `dependencies` reduced to workspace package links only (`@norish/*`)
- Third-party runtime dependencies redistributed into owning workspace manifests under `apps/*` and `packages/*`
- Root script-level gates added:
  - `hygiene:root`
  - `deps:workspace`
  - `monorepo:check`

## 3) Root File Placement Cleanup

### 3.1 Classification

- **Removed wrappers**: `next.config.js`, `postcss.config.js`
- **Temporary shims kept**: `eslint.config.mjs`, `vitest.config.ts`, `tsdown.config.ts`

### 3.2 Root Entry Points and Wrapper Pruning

- Duplicate root wrappers for Next/PostCSS were removed in favor of workspace-owned config files under `apps/web/`
- Root config layout is now validated by the root hygiene gate against policy allowlists

### 3.3 Temporary Shim Tracking

- All remaining temporary shims are tracked with owner, rationale, and removal milestone in `tooling/monorepo/root-hygiene-policy.json`

## 4) Install Behavior Hardening

- `.npmrc` updated to ownership-safe defaults:
  - `shamefully-hoist=false`
  - `hoist=false`
  - `strict-peer-dependencies=true`
  - `auto-install-peers=false`

## 5) Root Hygiene Guardrails

- Added root gate: `scripts/check-root-hygiene.mjs`
- Added workspace declaration gate: `scripts/check-workspace-dependencies.mjs`
- Wired both checks into local/CI flow through `lint:check` via `monorepo:check`

## 6) Validation and Before/After Snapshot

### 6.1 Command Evidence

- `CI=true pnpm install --no-frozen-lockfile`: **pass**
- `pnpm lint:check`: **pass with warnings** (existing import-order/prettier warnings across repo)
- `pnpm run typecheck`: **fail (pre-existing)**
  - Current failure shape: existing `TS7006` implicit `any` errors and one `ThemeProviderProps` mismatch in app UI code
- `pnpm test:run`: **fail (pre-existing)**
  - Current failure shape: many existing test assertions/context failures unrelated to manifest redistribution
- `pnpm build`: **fail (blocked by existing type errors)**
- `pnpm run deps:cycles`: **pass**
- `openspec validate refactor-monorepo-root-cleanup --strict --no-interactive`: **pass**
- `pnpm run monorepo:check`: **pass**

### 6.2 Root Before/After Comparison

- Before/after manifest and root-file comparisons:
  - Root dependency surface changed from `66` -> `9`
  - Third-party root dependencies changed from `57` -> `0`
  - Root wrappers removed: `next.config.js`, `postcss.config.js`
- Evidence and policy sources:
  - `package.json`
  - `.npmrc`
  - `tooling/monorepo/root-hygiene-policy.json`
  - `scripts/check-root-hygiene.mjs`
  - `scripts/check-workspace-dependencies.mjs`

### 6.3 Exception Completeness

- Temporary shim and dependency exceptions are all tracked with owner + removal milestone in `tooling/monorepo/root-hygiene-policy.json`
