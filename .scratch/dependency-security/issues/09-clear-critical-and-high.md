# 09 — Clear the remaining critical and high findings

Status: superseded
Target version: 0.26.0-beta
Blocked by: 06, 07, 08

Spec: `.scratch/dependency-security/spec.md`

## What to build

After the upgrades, every critical or high finding `pnpm audit` still lists outside `apps/mobile` is cleared with a `pnpm-workspace.yaml` override to the fixed version, or with a parent bump where one exists. The same for `apps/docs`, which has its own lockfile (`pnpm install --ignore-workspace` there).

The mobile findings that remain are listed under `## Comments` here as accepted, with the path each comes through.

## Acceptance criteria

- [ ] `pnpm audit --audit-level=high` lists only the accepted mobile entries.
- [ ] `pnpm audit --audit-level=high` in `apps/docs` lists nothing, and the docs build.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm build`, `pnpm deps:cycles`, `pnpm format:check` pass.
- 2026-10-13 — Superseded by `.scratch/dependency-upgrades/` (decided with the maintainer the same day).
