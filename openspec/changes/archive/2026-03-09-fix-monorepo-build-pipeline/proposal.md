## Why

The monorepo migration introduced new packages (`shared-react`, `shared-server`, `trpc`) and `tooling/*` workspaces, but the Dockerfile, CI pipeline, `.dockerignore`, and package export maps were not updated to reflect the new structure. The web app build is currently broken because `@norish/shared-react` doesn't export the `hooks/recipe-detail` subpath that the web app's recipe detail context imports. These issues must be fixed before any release or PR can pass CI.

## What Changes

- **Fix `@norish/shared-react` exports**: Add missing subpath exports (`./hooks/recipe-detail`, and any other deep subpaths consumed by `apps/web` or `apps/mobile`) to the package's `exports` map, or update the import in `apps/web` to use the barrel export like mobile does.
- **Fix Dockerfile**: Add missing `COPY` lines for `packages/shared-react`, `packages/shared-server`, `packages/trpc`, and all `tooling/*/package.json` files in both the `deps` and `prod-deps` stages. Add `patches/` directory copy needed for `patchedDependencies`.
- **Fix `.dockerignore`**: Remove `**/dist` exclusion that blocks `COPY` of `packages/trpc/dist` (required for type declarations at runtime). Add exclusions for `apps/mobile` (not needed in Docker) and the `openspec/` directory.
- **Fix CI GitHub Actions workflows**: Ensure the `build` step in `pr-quality.yml` runs correctly with the full monorepo structure, including the mobile filter exclusion so `turbo run build` doesn't attempt to build the mobile app in CI.
- **Fix Turbo pipeline**: Verify `turbo.json` `build` task correctly handles packages that have no `build` script (like `shared-react`, `shared-server`) vs those that do (like `trpc`).
- **Fix root `package.json` scripts**: Ensure `build:prod`, `docker:build`, and related scripts are wired correctly for the full monorepo.
- **Align pnpm version**: Dockerfile pins `pnpm@10.11.0` but root `package.json` specifies `pnpm@10.30.1` — these must match.
- **Fix HeroUI `@source` path**: The `@source` directive in `globals.css` pointed to `../node_modules/@heroui/theme/dist/` which resolved to `apps/web/node_modules/` — but pnpm hoists `@heroui/theme` to root `node_modules/`. This meant Tailwind never scanned HeroUI's component class names, so all component styles (rounded corners, spacing, data-attribute variants) were missing.

## Capabilities

### New Capabilities

_None — this is a fix/alignment change, not a new feature._

### Modified Capabilities

- `monorepo-architecture`: The Dockerfile, CI workflows, and `.dockerignore` must include all workspace packages created during the monorepo migration (shared-react, shared-server, trpc, tooling/\*). The package export maps must cover all subpath imports used across apps.

## Impact

- **Dockerfile** (`docker/Dockerfile`): Both `deps` and `prod-deps` stages need 6+ new `COPY` lines for missing package.json files. Patches dir needs copying.
- **`.dockerignore`**: Needs updates to allow `dist/` for trpc types while excluding mobile/openspec dirs.
- **CI workflows** (`.github/workflows/*.yml`): May need build filter adjustments to exclude mobile app from `turbo run build` in CI.
- **`packages/shared-react/package.json`**: Exports map update or web app import path fix.
- **Root `package.json`**: Script alignment and pnpm version sync.
- **`turbo.json`**: Potentially needs build filter configuration.
