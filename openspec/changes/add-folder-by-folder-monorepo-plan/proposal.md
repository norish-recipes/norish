# Change: Add Folder-by-Folder Monorepo Migration Plan

## Why

Norish already has a strong monorepo foundation proposal (`refactor-turborepo-monorepo-foundation`), but migration execution is still ambiguous at the folder level. The team now has a working `turbo-norish` reference, yet it contains starter placeholders and naming conventions that need Norish-specific decisions.

To execute safely, we need a deterministic answer for every current Norish folder: where it goes, when it moves, whether it is split, and whether it should remain generated/runtime-only. We also need explicit phase gates so migration can proceed with clear checkpoints rather than ad-hoc file movement.

## What Changes

- Add a folder-placement capability that maps every top-level Norish folder to a target monorepo location or disposition.
- Add a phased migration capability with ordered phases, entry/exit criteria, rollback checkpoints, and validation gates.
- Define how `turbo-norish` is used as a scaffold reference only (replace placeholder source code, retain only useful workspace/tooling patterns).
- Define `i18n` split strategy where locale catalogs/helpers become a package while Next.js runtime adapter stays in `apps/web`.
- Define shared-types ownership rules so cross-runtime contracts move to `packages/shared`, while backend-only and app-only types stay with owning packages/apps.
- Define folder-level sequencing across phases so each migration wave has explicit scope and dependency order.
- Define runtime/generated folder handling (`node_modules`, `.next`, `dist-server`, `uploads`, `yt-dlp`) to avoid treating artifacts as source migration scope.

## Impact

- Affected specs:
  - `monorepo-folder-placement` (new)
  - `monorepo-migration-phasing` (new)
- Related change:
  - `refactor-turborepo-monorepo-foundation` (prerequisite baseline)
- Affected code (planned during implementation):
  - Workspace manifests and task graph (`package.json`, `pnpm-workspace.yaml`, `turbo.json`)
  - Product layout (`app/**`, `components/**`, `context/**`, `hooks/**`, `i18n/**`, `lib/**`, `server/**`, `types/**`)
  - Tooling and CI (`tooling/**`, `.github/workflows/**`)
  - Deployment and runtime operations (`docker/**`, compose files, startup/build scripts)
