# 28 — The lockfile is refreshed and sheds unused optional peers

Status: resolved
Blocked by: 23 (apps/mobile out of the workspace, re-locked from scratch)
Target release: 0.26.0-beta (early, so the cycle soaks it)

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

**1. Remove the unused optional peers.** Add these `overrides` entries in `pnpm-workspace.yaml`:

```yaml
overrides:
  # … the existing entries stay as they are …
  # Optional peers resolved once and never used; they only carry advisories
  "drizzle-kit>@esbuild-kit/esm-loader": "-"
  "@prisma/client": "-"
  mysql2: "-"
  prisma: "-"
```

- **prisma 7.4.2** was resolved once as an optional peer of better-auth and drizzle-orm, and nothing in Norish uses it. It carries:
  - lodash 4.17.21, through an exact pin in chevrotain;
  - hono and @hono/node-server;
  - effect;
  - mysql2;
  - valibot;
  - deepmerge-ts.
- **`@esbuild-kit/esm-loader`** is deprecated, and drizzle-kit's bundle never loads it. It carries esbuild 0.18.20.

**2. In-range dev bumps:**

- `@testcontainers/postgresql` and `@testcontainers/redis` `^12.2.0`.
- `jsdom` `^30.1.2`. It needs Node `^22.22.2`, `^24.15` or later; CI satisfies that.
- `drizzle-orm` 0.45.4. It changes only postgres-js, and Norish uses node-postgres.

**3. Refresh everything else within the existing ranges.**

- In a scratch run, `pnpm update -r` changed 557 packages and a from-scratch re-lock changed 626.
- Review the diff by package, not line by line: group it by direct dependency, and read the changelog of anything that ships in the image.

**4. No floors here.** Ticket 03 clears the remaining advisories at the end of the sweep.

## Acceptance criteria

- [ ] **Peers gone.** `pnpm why prisma mysql2 @prisma/client @esbuild-kit/esm-loader` prints nothing. `pnpm db:generate` and `pnpm db:push` against a scratch database still work, proving drizzle-kit doesn't need the removed loader.
- [ ] **Audit.** The `pnpm audit` count is recorded before and after.
- [ ] **Gates and E2E.** The repo gates pass, `pnpm test:e2e` passes, and a Docker build passes its health check.

## Comments

- Filed 2026-10-12, split out of ticket 03 when the maintainer limited 0.25 to safe fixes.
- 2026-10-13 — Runs right after ticket 23's re-lock; ticket 03's floors were never applied, so there is nothing to prune.
- 2026-10-13 — Done. Re-locked from scratch (the current install record under `node_modules/.pnpm/lock.yaml` has to go too, or pnpm reuses old resolutions): 347 package versions in, 488 out. Direct bumps no other ticket owns: testcontainers 12.2.1, @testing-library/react 16.3.3, @types/ws 8.18.2, drizzle-orm 0.45.4, jsdom 30.1.2, jszip 3.10.2, mime 4.1.1, ollama 0.6.4, pg 8.23.1, pino 10.4.0, pino-pretty 13.2.0, postcss 8.5.30, tsdav 2.4.0, uuid 14.0.3, ws 8.22.0, yaml 2.9.1. In-range moves that land early for their own tickets: bullmq 5.81.5, ai 7.0.138, next-intl 4.14.9, vite 8.3.4, prettier 3.9.10, turbo 2.11.7, typescript-eslint 8.71.2, undici 7.30.0. `@tanstack/query-persist-client-core` is pinned to 5.101.4 until ticket 08 moves it with react-query; a caret let it float to 5.104.2 and bring a second `query-core`. `pnpm audit`: 130 findings before, 1 after (braces via `@next/eslint-plugin-next` › fast-glob, dev-only, no fix). `pnpm db:generate` reports no schema changes without `@esbuild-kit/esm-loader`. A second react-aria-components (1.22.1, via `@adobe/react-spectrum`) remains until ticket 19.
