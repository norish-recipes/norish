# 38 — Overrides and allowBuilds hold only what is needed

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`, tickets 03 and 28. Found in the branch review on 2026-10-13.

## What to build

The branch added these entries to `pnpm-workspace.yaml`. None of them is needed for anything to work.

- **`"@prisma/client"`, `prisma` and `mysql2` set to `"-"`.**
  - They are optional peers of Better Auth's adapters, and the comment says they "only carried advisories".
  - Optional peers are not installed unless something asks for them.
  - To prove it, delete them and run `pnpm install --lockfile-only`. An unchanged lockfile means they were dead.
- **`drizzle-kit>@esbuild-kit/esm-loader: "-"`.** The comment calls this an optional peer, which is wrong.
  - It is a regular dependency of drizzle-kit 0.31.11 (npm `latest`). It is deprecated ("merged into tsx") and drizzle-kit never loads it: its `bin.cjs` and `api.js` contain no reference to it.
  - The override deletes it only to clear the esbuild 0.18 dev-server advisory (GHSA-67mh-4wv8-2f99, medium) that it brings in.
  - Remove the override. The advisory then shows in `pnpm audit` until drizzle-kit 1.0, which is a held line, drops the dependency.
- **`allowBuilds` entries `@heroui/shared-utils` and `unrs-resolver`.** Neither package is in the lockfile.

## Acceptance criteria

- [x] Those four overrides and two `allowBuilds` entries are gone.
- [x] `pnpm install --frozen-lockfile` and `pnpm audit --audit-level=high` pass.
- [x] Every remaining override has a comment that says why it is there (ticket 03's rule).

## Comments

- Filed 2026-10-13 from the branch review.
- 2026-10-14 (implemented) — The `@prisma/client`, `prisma`, `mysql2` and `drizzle-kit>@esbuild-kit/esm-loader` overrides and the `@heroui/shared-utils` and `unrs-resolver` `allowBuilds` entries are gone.
  - Removing the three optional-peer overrides changed nothing in the lockfile but the overrides block itself: they were dead. Removing the esm-loader one brought back `@esbuild-kit/esm-loader` 2.6.5, `@esbuild-kit/core-utils`, esbuild 0.18.20 with its platform packages, `get-tsconfig` and `source-map-support`, as expected; `pnpm db:generate` still reports no schema changes.
  - The tRPC and TanStack Query pins now say why they are there (one copy each across the workspaces, ticket 08); zod already did.
  - `pnpm install --frozen-lockfile` passes. **`pnpm audit --audit-level=high` does not**, and did not before this ticket: its one high finding is `braces` ≤ 3.0.3 (GHSA-vfj7-8cjw-p6xm) through `tooling/eslint` › `@next/eslint-plugin-next` › fast-glob › micromatch, with no patched release, so no override can clear it (ticket 28 recorded it as the one finding left). The esm-loader's esbuild 0.18 advisory (GHSA-67mh-4wv8-2f99) shows as moderate, as the ticket expected, until drizzle-kit 1.0. Criterion left unticked for the maintainer: accept braces until `@next/eslint-plugin-next` moves off fast-glob 3, or ignore that advisory in `auditConfig`.
- 2026-10-14 (review fixes) — The maintainer chose to ignore the braces advisory: `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml` lists GHSA-vfj7-8cjw-p6xm with why (no patched release; only the lint plugin reaches it, with the repo's own globs). `pnpm audit --audit-level=high` exits 0 (1 moderate, the esm-loader's esbuild; 1 high ignored), and the frozen install passes.
