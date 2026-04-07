## Context

The Norish project completed phase 1 of its monorepo migration, introducing a Turborepo workspace structure with `apps/web`, `apps/mobile`, and 11 packages under `packages/*` plus 6 tooling packages under `tooling/*`. However, the infrastructure layer (Dockerfile, CI, export maps) was not fully updated to reflect the new workspace topology:

1. **Web build is broken**: `apps/web` imports `@norish/shared-react/hooks/recipe-detail` — a subpath that doesn't exist in the `exports` map. The mobile app imports the same symbol via `@norish/shared-react/hooks` (barrel export), which works. This inconsistency blocks `next build`.

2. **Dockerfile is stale**: Three packages added during migration (`shared-react`, `shared-server`, `trpc`) and all `tooling/*` packages are missing from the `COPY` lines in both `deps` and `prod-deps` stages. The `patches/` directory (needed for `patchedDependencies`) is also missing.

3. **`.dockerignore` blocks trpc types**: The blanket `**/dist` exclusion prevents `packages/trpc/dist/` (generated type declarations) from being copied into the build context.

4. **pnpm version mismatch**: Dockerfile pins `pnpm@10.11.0` but `package.json` declares `pnpm@10.30.1`.

5. **CI builds mobile unnecessarily**: `turbo run build` will attempt to build `@norish/mobile`, which requires Expo/native tooling not available in CI.

## Goals / Non-Goals

**Goals:**

- Fix `next build` so the web app compiles successfully
- Make the Docker image buildable with the current monorepo structure
- Ensure all CI workflows pass with the full workspace topology
- Align versions and configuration across all infrastructure files

**Non-Goals:**

- Splitting the Dockerfile into separate app-specific stages (future work)
- Adding mobile CI/CD (handled by separate Expo EAS pipelines)
- Refactoring the custom server build (`tsdown`) — that works fine already
- Changing the Turborepo task graph beyond what's needed for build correctness

## Decisions

### 1. Fix the import path, not add granular exports

**Decision**: Update the web app's `context.tsx` to import from `@norish/shared-react/hooks` (the barrel) instead of `@norish/shared-react/hooks/recipe-detail` (the deep subpath). This matches how mobile already imports it.

**Rationale**: Adding deep subpath exports to `shared-react` for every internal module would create maintenance overhead and fragile coupling. The barrel pattern is already established and working for all other hooks across both apps. Keeping a single `./hooks` export keeps the API surface clean.

**Alternative considered**: Adding `"./hooks/recipe-detail"` to exports — rejected because it would set a precedent for dozens of deep subpaths and is inconsistent with how every other hook is imported.

### 2. Use wildcard COPY for workspace package.json files in Dockerfile

**Decision**: Replace the individual `COPY packages/<name>/package.json` lines with a script or comment-gated approach that explicitly lists all current packages, including `shared-react`, `shared-server`, and `trpc`. Also add tooling package.json files.

**Rationale**: Docker `COPY` doesn't support globs the way we need (can't `COPY packages/*/package.json`), so we must list them. Making the list complete and adding a comment header makes it easier to audit.

### 3. Selective `.dockerignore` for dist directories

**Decision**: Change `**/dist` to specific exclusions. Allow `packages/trpc/dist` (needed for type declarations) while excluding other dist folders like `dist-server` (already excluded explicitly).

**Rationale**: The `trpc` package generates type declaration files in `dist/` that are referenced by its `exports.types` field. Blocking all `dist/` breaks type resolution in the build context.

### 4. Exclude mobile from turbo build in CI

**Decision**: Add a turbo filter to CI build commands: `turbo run build --filter='!@norish/mobile'` or configure the mobile app's `package.json` to have no `build` script.

**Rationale**: The mobile app uses Expo's build system (EAS), not a local turbo-managed build. Attempting to build it in CI would fail due to missing native tooling. The mobile `package.json` should not have a `build` script that turbo would try to execute.

### 5. Sync pnpm version

**Decision**: Update the Dockerfile to pin `pnpm@10.30.1` matching the `packageManager` field in root `package.json`.

**Rationale**: Mismatched pnpm versions can produce different lockfile interpretations and install trees. The `packageManager` field is the source of truth.

## Risks / Trade-offs

- **Risk**: Future packages added to `packages/*` or `tooling/*` won't automatically appear in Dockerfile → **Mitigation**: Add a comment in the Dockerfile listing the convention and add a CI check or doc reminder.
- **Risk**: Barrel export from `shared-react/hooks` pulls in all hooks even if only one is needed → **Mitigation**: Tree-shaking handles this at build time; the barrel is only for development ergonomics.
- **Risk**: Removing `**/dist` from `.dockerignore` could increase Docker context size → **Mitigation**: We're only allowing `packages/trpc/dist` specifically; all other patterns remain excluded.
