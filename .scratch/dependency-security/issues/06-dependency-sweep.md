# 06 — Everything else to latest

Status: superseded
Target version: 0.26.0-beta
Blocked by: 05

Spec: `.scratch/dependency-security/spec.md`

## What to build

Every dependency in the workspace to its latest version, `apps/mobile` excluded; `better-auth`, `bullmq` and `ioredis` are tickets 07 and 08. Includes pnpm 11 (`packageManager`, lockfile, `pnpm-workspace.yaml` settings such as the build-scripts allowlist) and next 16.4.

TypeScript 7, ESLint 10 and zod-openapi 6 were held for peer ranges (`typescript-eslint`, `eslint-plugin-react`/`-import`/`-jsx-a11y`, `trpc-to-openapi`). Take each whose blocker has moved; for each that is still blocked, write the blocker into this file under `## Comments`.

`apps/landing` is in the workspace and moves with it.

## Acceptance criteria

- [ ] `pnpm outdated -r` lists only `apps/mobile` and the held packages named here.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm deps:cycles`, `pnpm format:check` and `pnpm test:e2e` pass.
- 2026-10-13 — Superseded by `.scratch/dependency-upgrades/` (decided with the maintainer the same day).
