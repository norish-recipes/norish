# 08 — zod, tRPC and TanStack Query move together

Status: resolved
Blocked by: 25 (type checking)
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move the three lines the root `overrides` pin. Each moves together with its catalog entry:

| Package                                                      | Catalog and override today | Target                      |
| ------------------------------------------------------------ | -------------------------- | --------------------------- |
| `zod`                                                        | 4.4.3                      | 4.6.x (4.6.7 on 2026-10-13) |
| `@trpc/client`, `@trpc/server`, `@trpc/tanstack-react-query` | 11.18.0                    | 11.19.0                     |
| `@tanstack/react-query`                                      | 5.101.4                    | 5.104.2                     |

- **Move `@tanstack/query-persist-client-core` in apps/web too**, at the same version. Otherwise a second `query-core` copy appears.

**Why now.** Better Auth 1.7 (ticket 09) calls `z.validate()`, which needs zod ≥ 4.5, in `@better-auth/core` on every session creation and rate-limit check. With the 4.4.3 override, every sign-in on 1.7 would throw.

**Before changing anything:**

- **Why zod is pinned** (traced 2026-10-13; the hash `53469908` given earlier was wrong). The override was added in 53f225ce (2026-07-13) and re-added in 3f434dd5 (2026-07-23, "fix: last couple of build issues"), whose lockfile diff collapsed five zod copies into one; 5648f58e (#533) moved it to 4.4.3 with the catalog. The 0.20 squash (10914fd1) mentions TS2742 errors naming `@norish/shared/node_modules/zod`. So the pin keeps one zod instance across the workspaces, zod-openapi, trpc-to-openapi and better-auth. Write this next to the override in `pnpm-workspace.yaml`.
- **Read the notes of the zod release you take.**
- **Keep the overrides as pins.** They exist to keep one copy of each package across the workspaces; move their values, don't drop them.

## Acceptance criteria

- [x] **Single copies.** `pnpm why zod @trpc/server @tanstack/query-core` shows one version of each.
- [x] **OpenAPI document.** The generated document (`/api/docs`; trpc-to-openapi with zod-openapi 5.4.x) is unchanged. Diff it before and after.
- [x] **Type check.** `pnpm typecheck` passes.
- [x] **Gates and E2E.** The repo gates pass, and `pnpm test:e2e` passes (the offline and realtime projects exercise the TanStack persist layer and tRPC subscriptions).

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-13 — Targets refreshed; the zod pin's reason recorded above.
- 2026-10-13 — Done on zod 4.6.7, tRPC 11.19.0 and TanStack Query 5.104.2 (with `query-persist-client-core` in apps/web). The lockfile holds one copy each of `zod`, `@trpc/server`, `@tanstack/query-core` and `@tanstack/react-query`; the pin's reason is written next to the zod override. **The OpenAPI document changed in spelling only:** zod 4.6 writes a nullable primitive as `type: ["string", "null"]` where 4.4 wrote `anyOf: [{ type: "string" }, { type: "null" }]`. Read back as anyOf, the old and new documents are identical (checked with a script that normalises one form into the other), so no operation, field or bound changed. The docs site's API reference read `type` as a string and would have printed `string,null`; it now reads the list as the anyOf it means. The published copy is refreshed. typecheck, lint, test:run, i18n:check, build, format:check and deps:cycles pass; `pnpm test:e2e`: 175 passed.
