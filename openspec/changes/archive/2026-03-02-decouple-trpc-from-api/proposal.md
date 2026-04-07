## Why

We need a clear ownership model for TRPC that removes `@norish/trpc -> @norish/api` coupling without introducing a large DI registry. The target model is the same pattern used in mature setups: TRPC package owns router/procedures/contracts, and API package only hosts/mounts the `/trpc` endpoint.

## What Changes

- Keep `AppRouter`, procedure definitions, and TRPC runtime logic in `@norish/trpc`.
- Keep `/trpc` endpoint hosting in `@norish/api`, where API imports and mounts `@norish/trpc` router.
- Remove direct `@norish/api/*` imports from `packages/trpc/src/**` by re-homing shared logic into boundary-safe modules (existing shared/runtime packages or TRPC-owned modules).
- Preserve endpoint behavior and client contracts while enforcing one-way dependency direction (`api -> trpc`, never `trpc -> api`).
- Keep existing validation and boundary checks only; no new custom scripts.

## Capabilities

### New Capabilities

- `trpc-api-layer-separation`: Define and enforce a package/layer split where TRPC owns router/procedures/contracts and API owns endpoint hosting.

### Modified Capabilities

- `dependency-boundaries`: Tighten requirement language to enforce one-way import direction (`api -> trpc`, not `trpc -> api`).
- `mobile-trpc-type-boundary`: Clarify that client-facing TRPC typing stays stable with `AppRouter` sourced from TRPC boundary exports.

## Impact

- Affected code: `packages/trpc/src/*`, `packages/api/src/*` (endpoint adapter/mount points), and package manifests for dependency direction.
- API/runtime impact: no intended endpoint behavior changes; import ownership and module placement are refactored.
- Tooling impact: existing checks (`deps:cycles`, workspace deps checks, typecheck/build) remain the acceptance path; no new scripts added.
