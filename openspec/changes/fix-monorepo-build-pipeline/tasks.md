## 1. Fix HeroUI Styling — @source Path

- [x] 1.1 Fix `@source` path in `apps/web/styles/globals.css` from `../node_modules/` to `../../../node_modules/` to point to root-hoisted `@heroui/theme`
- [x] 1.2 Verify HeroUI component styling renders correctly (rounded corners, floating labels, proper spacing)

## 2. Fix Web Build — Import Path

- [x] 2.1 Update `apps/web/app/(app)/recipes/[id]/context.tsx` to import `createRecipeDetailContext` from `@norish/shared-react/hooks` (barrel export) instead of `@norish/shared-react/hooks/recipe-detail` (missing subpath export)
- [x] 2.2 Verify `pnpm run build:web` completes successfully after the import fix

## 3. Fix Dockerfile — Missing Workspace Packages

- [x] 3.1 Add `COPY packages/shared-react/package.json ./packages/shared-react/package.json` to both `deps` and `prod-deps` stages
- [x] 3.2 Add `COPY packages/shared-server/package.json ./packages/shared-server/package.json` to both `deps` and `prod-deps` stages
- [x] 3.3 Add `COPY packages/trpc/package.json ./packages/trpc/package.json` to both `deps` and `prod-deps` stages
- [x] 3.4 Add `COPY tooling/eslint/package.json ./tooling/eslint/package.json` to both `deps` and `prod-deps` stages
- [x] 3.5 Add `COPY tooling/prettier/package.json ./tooling/prettier/package.json` to both `deps` and `prod-deps` stages
- [x] 3.6 Add `COPY tooling/tailwind/package.json ./tooling/tailwind/package.json` to both `deps` and `prod-deps` stages
- [x] 3.7 Add `COPY tooling/typescript/package.json ./tooling/typescript/package.json` to both `deps` and `prod-deps` stages
- [x] 3.8 Add `COPY patches/ ./patches/` before `pnpm install` in `deps` stage (required for `patchedDependencies`)
- [x] 3.9 Update pnpm version in Dockerfile from `10.11.0` to `10.30.1` to match `packageManager` field in root `package.json`

## 4. Fix `.dockerignore`

- [x] 4.1 Replace blanket `**/dist` exclusion with specific exclusions that allow `packages/trpc/dist/` through (type declarations needed for build)
- [x] 4.2 Add `apps/mobile/` exclusion (not needed in Docker build)
- [x] 4.3 Add `openspec/` exclusion (not needed in Docker build)

## 5. Verify CI Compatibility

- [x] 5.1 Confirm `apps/mobile` has no `build` script and turbo won't attempt to build it in CI
- [x] 5.2 Run full `turbo run build` locally (or `pnpm run build`) and verify it completes without errors for all non-mobile workspaces
- [x] 5.3 Verify `docker build -f docker/Dockerfile -t norish:test .` completes successfully

## 6. Validation

- [x] 6.1 Run `pnpm run build:web` — Next.js production build passes
- [x] 6.2 Run `pnpm run build` — Full turbo build passes
- [x] 6.3 Run `pnpm run docker:build` — Docker image builds successfully
- [x] 6.4 Verify no other `@norish/*` subpath imports exist that aren't covered by package `exports` maps
