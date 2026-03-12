# Phase 0 Evidence

## 1.1 Prerequisite Outputs Present

- `refactor-turborepo-monorepo-foundation` artifacts are present:
  - `openspec/changes/refactor-turborepo-monorepo-foundation/circular-deps-baseline.json`
  - `openspec/changes/refactor-turborepo-monorepo-foundation/web-to-backend-import-inventory.json`
  - `openspec/changes/refactor-turborepo-monorepo-foundation/specs/dependency-boundaries/spec.md`
  - `openspec/changes/refactor-turborepo-monorepo-foundation/specs/monorepo-architecture/spec.md`
- `openspec show refactor-turborepo-monorepo-foundation --json --deltas-only` confirms delta output for dependency-boundary and monorepo-architecture requirements.

## 1.2 Top-Level Inventory vs Folder Matrix

Snapshot source: repository root directory scan (current workspace).

| Entry          | Kind      | In placement matrix |
| -------------- | --------- | ------------------- |
| `.github`      | directory | yes                 |
| `.next`        | directory | yes                 |
| `.vscode`      | directory | yes                 |
| `__tests__`    | directory | yes                 |
| `app`          | directory | yes                 |
| `components`   | directory | yes                 |
| `config`       | directory | yes                 |
| `context`      | directory | yes                 |
| `dist-server`  | directory | yes                 |
| `docker`       | directory | yes                 |
| `hooks`        | directory | yes                 |
| `i18n`         | directory | yes                 |
| `lib`          | directory | yes                 |
| `node_modules` | directory | yes                 |
| `openspec`     | directory | yes                 |
| `public`       | directory | yes                 |
| `scripts`      | directory | yes                 |
| `server`       | directory | yes                 |
| `stores`       | directory | yes                 |
| `styles`       | directory | yes                 |
| `tooling`      | directory | yes                 |
| `types`        | directory | yes                 |
| `uploads`      | directory | yes                 |
| `yt-dlp`       | file      | yes                 |

Verification result:

- All matrix entries for phase planning are present in the repository root.
- No unexpected top-level source directories were found (excluding `.git` repository metadata).

## 1.3 Rollback Checkpoint Marker

- Created annotated tag: `monorepo-phase-0-checkpoint`
- Tag target commit: `d74d544`
- Purpose: pre-workspace-bootstrap rollback anchor.

## 1.4 Checkpoint Naming and Evidence Convention

- Checkpoint naming format: `monorepo-phase-<n>-checkpoint`
- Evidence file format: `openspec/changes/add-folder-by-folder-monorepo-plan/phase-<n>-evidence.md`
- Each phase evidence file must include:
  - completed task mapping
  - validation command list and outcomes
  - checkpoint marker name and commit hash
  - rollback notes for failed gate follow-up
