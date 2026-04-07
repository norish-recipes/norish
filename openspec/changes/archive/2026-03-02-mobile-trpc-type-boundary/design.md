## Context

Mobile and web currently consume tRPC contracts through `@norish/api/trpc` entrypoints. This path is convenient for inference but couples client typing and server runtime wiring to API workspace internals. `apps/mobile` has already hit blocked typechecks due to transitive server/workspace issues, and the same coupling pattern leaves web and other consumers vulnerable to boundary breakage.

The change must preserve strict tRPC typing in mobile and web (no `any` fallback), keep runtime behavior unchanged for auth/connect/login/register and existing app calls, and introduce a clean boundary that supports reliable workspace builds.

## Goals / Non-Goals

**Goals:**

- Provide a clean public tRPC boundary for client consumers (`AppRouter` plus minimal supporting public tRPC types).
- Allow `apps/mobile` typecheck to run independently from unrelated server source compile failures.
- Keep mobile and web tRPC provider/client integrations strongly typed and aligned with server router contracts.
- Ensure workspace build/typecheck targets pass after migration.
- Keep runtime request behavior unchanged.

**Non-Goals:**

- Replacing tRPC transport or client architecture.
- Rewriting server routers/procedures.
- Suppressing errors with broad `skipLibCheck`, `skip` scripts, or `any` casts.

## Decisions

### Decision 1: Compare boundary strategies and choose extracted standalone tRPC package

Option A - Type-only export from `@norish/api` via declarations/dist:

- Approach: build declarations in `@norish/api` and expose `@norish/api/trpc-types` subpath.
- Pros: minimal package count; no extra package publishing/linking.
- Cons: mobile still depends on API package build outputs and lifecycle; boundary can drift if API package exports/runtime concerns change; CI ordering still tightly coupled to API package state.

Option B - Dedicated contract package generated from API declarations:

- Approach: add `@norish/trpc-contract` (or `@norish/api-trpc-types`) that ships declaration-only public types generated from API router declarations.
- Pros: strongest boundary clarity; client dependencies are explicit and runtime-safe; independent client typecheck is easier to gate in CI; migration path for additional clients is straightforward.
- Cons: extra package/build step and release choreography; requires clear generation/update workflow to avoid stale contracts.

Option C - Extract tRPC from API into a standalone package:

- Approach: move router composition and related modules out of API package into a new shared package consumed by server and clients.
- Pros: cleanest ownership model; single source of truth for router contracts and composition; removes API-package coupling for all clients, not only mobile.
- Cons: larger scope than A/B; requires careful package boundary design and import migration; higher chance of temporary breakage during extraction.

Chosen approach: **Option C**.

Rationale:

- Produces the cleanest long-term dependency graph by making tRPC contracts independent of API runtime package internals.
- Solves mobile isolation and also prevents the same coupling issue for future clients.
- Acceptable migration risk for this non-release branch, with rollback available through git history if extraction destabilizes.

### Decision 2: Extracted package exposes minimal public surface and keeps client imports type-only

- Export `type AppRouter` and only approved client-facing helper types from stable entrypoints.
- Keep mobile/client usage on `import type` paths so no extra runtime dependency is introduced in clients.
- API server may consume runtime router composition from this package, but server-only implementation details remain unexported.

### Decision 3: CI gates cover mobile isolation, web integration, and workspace build integrity

- Update mobile imports to extracted package types.
- Update web imports/provider typing to extracted package entrypoints.
- Ensure mobile tsconfig/script resolves extracted package declarations without traversing API source modules.
- Add/adjust CI targets so `apps/mobile` typecheck remains independent and workspace build/typecheck verifies migration completeness.

## Risks / Trade-offs

- [Extraction breaks API runtime wiring] -> Mitigation: migrate incrementally (create package, re-export temporary bridge, then switch imports), with smoke checks after each step.
- [Import churn across workspace] -> Mitigation: codemod/grep-based migration checklist and CI guard for banned `@norish/api/trpc` imports.
- [Boundary accidentally leaks server internals] -> Mitigation: strict export map with explicit entrypoints only.
- [Build order complexity in monorepo] -> Mitigation: explicit workspace dependency and Turbo pipeline ordering so extracted package builds before API/mobile/web typechecks/builds.
- [Large migration scope leaves stale imports] -> Mitigation: workspace-wide import audit and CI guard that fails on remaining `@norish/api/trpc` imports outside controlled compatibility bridge.

## Migration Plan

1. Create a new standalone tRPC package (name to follow workspace convention) and move router composition/types from `packages/api` into it without changing procedure behavior.
2. Add stable exports for `AppRouter` and approved client-facing types; keep server-only internals private.
3. Update `packages/api` to consume router/runtime pieces from the extracted package.
4. Update `apps/mobile` and `apps/web` to consume extracted package types/runtime exports and remove direct imports from `@norish/api/trpc`.
5. Migrate remaining workspace consumers (`packages/auth`, `packages/queue`, tests/mocks, and other references) off deprecated `@norish/api/trpc` paths.
6. Update workspace scripts/pipeline so mobile typecheck depends on extracted package artifacts, while workspace build/typecheck validates end-to-end migration.
7. Remove old `@norish/api/trpc` import path after migration (or keep short-lived compatibility re-export only during transition).
8. Validate `apps/mobile` typecheck isolation, web integration behavior, and full workspace build/typecheck success.
9. Document migration guidance for future clients.

Rollback plan:

- Keep a short-lived compatibility re-export from `@norish/api/trpc` while migration completes.
- If extraction destabilizes runtime/typecheck, revert the extraction commit series and restore previous import wiring.

## Open Questions

- Final package name convention for the extracted tRPC package should follow existing workspace naming norms.
- Decide whether compatibility re-export window is required or whether API/web/mobile/workspace consumers can migrate atomically.
