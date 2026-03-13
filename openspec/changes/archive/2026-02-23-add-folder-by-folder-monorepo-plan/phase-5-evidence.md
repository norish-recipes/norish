# Phase 5 Evidence

## 6.1 Root Scripts and Docs Updated for Workspace-Aware Commands

- Updated root workspace scripts in `package.json`:
  - Added `build:web` (`pnpm --filter @norish/web exec next build`)
  - Updated `build` to compose `build:web` + `build:server` + `update-sw`
  - Updated local Docker helper scripts to use Compose file `docker-compose.local.yml`
- Updated docs/examples to reflect workspace layout and runtime paths:
  - `README.md` (workspace build command, local Docker helpers, updated public asset path)
  - `.env.example` (runtime defaults for `UPLOADS_DIR` and `YT_DLP_BIN_DIR`)
  - `scripts/check-locale-keys.js` now reads locale files from `packages/i18n/src/messages`

## 6.2 GitHub Workflows Updated for Monorepo Quality Gates

- Updated `.github/workflows/pr-quality.yml`:
  - tests now run `pnpm run test:run`
  - lint now runs `pnpm run lint:check`
  - added a dedicated `typecheck` job (`pnpm run typecheck`)
  - locale check job now installs dependencies before execution
- Updated Docker/release workflows to avoid watch-mode tests and use workspace build command:
  - `.github/workflows/docker-build-test.yml` -> `pnpm run build`
  - `.github/workflows/release-build.yml` -> `pnpm run test:run`, `pnpm run build`
  - `.github/workflows/rc-release-build.yml` -> `pnpm run test:run`, `pnpm run build`

## 6.3 Docker and Compose Paths Updated for `apps/web` Monorepo Layout

- Updated `docker/Dockerfile` dependency stages to copy workspace manifests before install:
  - root manifests (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`)
  - workspace package manifests (`apps/web`, `packages/*`)
- Updated build cleanup path to `apps/web/.next/*`.
- Updated runtime stage to copy monorepo build/runtime artifacts from `apps/**`, `packages/**`, and `dist-server/**`.
- Updated compose example runtime env var in `docker/docker-compose.example.yml` from `RECIPES_DISK_DIR` to `UPLOADS_DIR`.

## 6.4 Uploads Converted to Runtime-Volume Semantics

- Server env defaults now distinguish runtime context in `packages/config/src/env-config-server.ts`:
  - development default: `./.runtime/uploads`
  - production default: `/app/uploads`
- Added `/.runtime` to `.gitignore` to keep runtime data out of source tracking.
- Compose/README examples explicitly use `/app/uploads` volume semantics.

## 6.5 `yt-dlp` Binary Removed from Source Path and Runtime Provisioning Enforced

- Removed root `yt-dlp` binary from the repository working tree and confirmed there is no tracked `yt-dlp` artifact in source paths.
- Verification command: `git ls-files yt-dlp` -> no output.
- Server env defaults now distinguish runtime context for binary path:
  - development default: `./.runtime/bin`
  - production default: `/app/bin`
- Added runtime bootstrap guard in `packages/api/src/video/yt-dlp.ts` to create bin directory before access/download.
- Docker runtime stage continues to provision `yt-dlp` during image build into `/app/bin/yt-dlp`.

## 6.6 Deployment Build Validation

Executed phase-5 deployment build checks:

1. `pnpm run i18n:check` - passed
2. `SKIP_ENV_VALIDATION=1 DATABASE_URL=postgresql://localhost:5432/norish pnpm run build` - passed
3. `docker build -f docker/Dockerfile -t norishapp/norish:phase5-test .` - passed
4. `openspec validate add-folder-by-folder-monorepo-plan --strict --no-interactive` - passed

Build gate notes:

- Docker build now succeeds with monorepo workspace manifests and `apps/web` runtime paths.
- Runtime startup/health/container boot smoke remains deferred to phase 6 per build-first gating.

## 6.7 Rollback Checkpoint Status

- Created annotated tag: `monorepo-phase-5-checkpoint`
- Tag target commit: `062981019dbdcfc8c403afe5b0ad32a34bee7453`
