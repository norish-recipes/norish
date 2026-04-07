## Context

We need to remove `@norish/trpc -> @norish/api` coupling while keeping runtime behavior unchanged and avoiding a large runtime dependency registry pattern. The target model is: `@norish/trpc` owns router/procedures/contracts, `@norish/api` hosts `/trpc` and mounts the router, and dependency direction remains one-way (`api -> trpc`).

## Goals / Non-Goals

**Goals:**

- Enforce one-way package dependency direction between API and TRPC.
- Keep client-facing TRPC contracts stable for mobile/web consumers.
- Preserve endpoint/runtime behavior while keeping router/procedure ownership in TRPC.
- Complete the migration as a clean cut with no compatibility shims, no temporary re-exports, and no dual-path imports.
- Use existing validation checks only; no new custom scripts.

**Non-Goals:**

- No framework migration (for example NestJS).
- No broad runtime service-locator registry introduced as required architecture.
- No intentional API contract changes for existing tRPC consumers.
- No long-lived compatibility layers between `@norish/api` and `@norish/trpc`.

## Decisions

### Decision: Use layer ownership instead of broad DI registry

- `@norish/trpc` owns `AppRouter`, procedures, and TRPC contracts.
- `@norish/api` owns endpoint hosting and mounts TRPC router via adapter/route integration.
- `@norish/trpc` SHALL NOT import `@norish/api/*`.
- Rationale: this keeps role clarity (TRPC is the router package, API is the host) with minimal ceremony.
- Alternative considered: centralized `runtime-deps.ts` contract and setter/getter. Rejected due to high fragility and maintenance overhead.

### Decision: Re-home API-only utilities currently imported by TRPC

- Any logic currently living under `@norish/api/*` but required by TRPC procedures will be moved to boundary-safe locations (TRPC-owned modules or existing shared/runtime packages) so TRPC no longer back-imports API.
- Rationale: preserves Model A ownership without forcing broad DI registries.
- Alternative considered: keep logic in API and inject everything into TRPC. Rejected due to high maintenance complexity.

### Decision: Clean-cut migration with no shims/re-exports

- During migration, imports are updated directly to final module homes.
- We will not add temporary compatibility wrappers, bridge modules, alias re-exports, or duplicate APIs.
- Rationale: avoids long-tail cleanup and guarantees final architecture at merge time.

### Decision: Keep package surface small and avoid package proliferation

- Prefer refactoring responsibilities inside existing `@norish/api` and `@norish/trpc` packages.
- Introduce a dedicated `@norish/shared-server` package as the single new boundary for server-only code shared by API and TRPC.
- Outside `@norish/shared-server`, avoid introducing additional package boundaries unless a concrete cycle cannot be resolved.
- Rationale: preserves developer ergonomics while meeting dependency-direction requirements.
- Alternative considered: introduce additional core/foundation packages now. Deferred to avoid package overload.

### Decision: Shared placement policy for cross-consumer code

- If code is used by both API and TRPC and is server-only, it should live in `@norish/shared-server` as the final home.
- If code is only consumed by server packages, it should live in `@norish/shared-server` even if it is technically client-safe.
- `@norish/shared` is reserved for modules that have intentional client consumers and are part of client-safe shared boundaries.
- Client-safe code may be exported through existing client-consumable shared entrypoints only when client consumption is required.
- `@norish/shared-server` must never be imported by client apps or client-facing shared entrypoints.
- Rationale: this keeps one canonical implementation for cross-consumer server logic while preserving client/server safety boundaries.

### Decision: Final destination map for utilities moved out of API

- Logging used by both API and TRPC -> `@norish/shared-server/logger`.
- Downloader/media utilities used by TRPC (`deleteRecipeImagesDir`, `saveVideoBytes`, `deleteVideoByUrl`) -> `@norish/shared-server/media/storage`.
- Avatar deletion helper used by TRPC (`deleteAvatarByFilename`) -> `@norish/shared-server/media/avatar-cleanup`.
- Recipe randomizer utility used by TRPC (`selectWeightedRandomRecipe`) -> `@norish/shared-server/recipes/randomizer`.
- Admin default-config helper used by TRPC (`getDefaultConfigValue`) -> `@norish/shared-server/config/defaults`.
- Archive parsing helpers used by TRPC -> `@norish/shared-server/archive/parser`.
- CalDAV helpers used by TRPC (`CalDavClient`, `testCalDavConnection`, `syncAllFutureItems`, `retryFailedSyncs`) -> `@norish/shared-server/caldav/*`.
- AI model listing + conversion helpers used by TRPC (`listModels`, `listTranscriptionModels`, unit converter) -> `@norish/shared-server/ai/*`.
- Any genuinely client-safe shared code remains in `@norish/shared`.

### Decision: Keep current validation gates

- Use existing monorepo dependency checks, typecheck targets, and build checks as acceptance criteria.
- Rationale: avoids adding script complexity while still validating boundary correctness.
- Alternative considered: add bespoke import-guard scripts. Rejected per project preference.

## Risks / Trade-offs

- [Risk] Re-homing modules from API paths can touch many imports at once. → Mitigation: migrate router domains incrementally and validate after each domain.
- [Risk] Hidden transitive imports from TRPC to API may remain after partial refactor. → Mitigation: verify package manifests/imports and run existing dependency/cycle checks.
- [Risk] Runtime regressions during ownership moves. → Mitigation: preserve procedure contracts and run existing build/typecheck plus targeted smoke verification.

## Migration Plan

1. Establish final module homes for TRPC-required server utilities (logger, downloader/media helpers, recipe randomizer, archive parser helpers, caldav helpers, admin config defaults, AI provider listing).
2. Create `@norish/shared-server` and move server-only API+TRPC shared utilities there; use `@norish/shared` only for code that is genuinely client-safe.
3. Move each utility to its final home (TRPC-owned server modules, `@norish/shared-server`, or `@norish/shared` for client-safe shared code) with direct import rewrites in all affected consumers.
4. Remove all `@norish/api/*` imports from `packages/trpc/src/**` in one domain pass at a time, with no bridge modules.
5. Keep API as the endpoint host only: confirm `/trpc` route and websocket adapter mount runtime from `@norish/trpc`.
6. Remove any manifest-level back-edge declarations (`trpc -> api`) and keep only `api -> trpc`.
7. Run dependency/cycle validation and fix violations immediately in the same pass.
8. Run mobile typecheck, full build, and targeted smoke checks; fix regressions before moving to next domain.
9. Finalize with migration notes documenting final ownership and validation outcomes.

Rollback strategy: revert ownership moves by router domain if behavior regressions are found; since contracts stay stable, rollback can be done per-domain without schema migration.

## Open Questions

- Which specific router domains should be migrated first to minimize churn and maximize confidence?
- Can `apps/mobile/declarations.d.ts` server-only ambient declaration be removed after boundary cleanup and mobile typecheck verification?
