# 14 — tsdown 0.23

Status: resolved
Blocked by: 11
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `tsdown` from 0.22.14 to **0.23.1** in apps/web, where it builds the custom server bundle `dist-server`. No changelog ships in the package, so the changes below come from diffing the types and defaults of the two versions:

- **`inlineOnly` was removed and is silently ignored** (`apps/web/tsdown.config.ts`).
- **`external` and `noExternal` are deprecated.** They still work, but they warn. Replace them with `deps.neverBundle`, `deps.alwaysBundle` and `deps.onlyBundle: false`, keeping exactly today's bundling.
- **`deps.resolveDepSubpath` now defaults to false** (it was true). External packages without an `exports` field keep extensionless subpaths.
  - The only candidates are `next/server` and `next/headers` in `packages/auth/src/withAuth.ts`.
  - They look unreachable from `server/index.ts`; verify that.
- **`minify` now defaults to `'dce-only'`.** Norish sets `false` explicitly, so nothing changes.
- **d.ts generation stays off**, so tsdown does not care which TypeScript version is installed.

## Acceptance criteria

- [ ] **No warnings.** `pnpm build:server` prints no deprecation warnings.
- [ ] **No Next imports.** `grep 'from "next/' apps/web/dist-server/index.mjs` returns nothing.
- [ ] **Same bundle shape.** The set of inlined versus external modules is unchanged: diff the bundle's import list before and after.
- [ ] **E2E and Docker.** `pnpm test:e2e` passes (it runs against `dist-server`), and so does the Docker health check.

## Comments

- Filed 2026-10-12 with the spec.
- Sources: the tsdown 0.22.14 and 0.23.1 tarballs, and their type definitions and defaults.
- 2026-10-13 — Done on tsdown 0.23.1: `noExternal` → `deps.alwaysBundle`, `external` → `deps.neverBundle`, `inlineOnly: false` → `deps.onlyBundle: false`. `pnpm build:server` prints no warnings; the bundle's import list is identical before and after (91 specifiers) and has no `next/` imports, so the new `resolveDepSubpath: false` default changes nothing. E2E against `dist-server` waits on the Chrome for Testing download (see ticket 11).
