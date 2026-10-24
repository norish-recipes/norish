# 41 — TypeScript config without leftovers

Status: wontfix
Duplicate of: 46
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, ticket 11. Found in the branch review on 2026-10-13.

## What to build

- **Node types for every workspace.** `tooling/typescript/base.json:8` sets `types: ["node"]`. That gives every workspace Node's globals, including the browser workspaces (`apps/web`, `apps/landing`, `packages/shared-react`). Nine packages repeat the same line.
  - Move the setting out of `base.json`.
  - Server and tooling workspaces keep their own `types: ["node"]`.
  - Browser workspaces get only what they use.
- **Settings TypeScript 6 already applies.** These are no-ops:
  - `esModuleInterop: true` in `base.json:4` and `tsconfig.server.json:9`
  - `strict: true`

## Acceptance criteria

- [ ] `base.json` sets no `types`, and no tsconfig sets an option to its TypeScript 6 default.
- [ ] `tsc --showConfig` shows the same effective `strict` and `esModuleInterop` for each workspace as before.
- [ ] `pnpm typecheck` passes.

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 — Folded into 46 (sweep leftovers) by the maintainer. Do the work there.
