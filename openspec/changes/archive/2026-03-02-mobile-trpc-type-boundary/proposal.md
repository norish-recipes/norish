## Why

`apps/mobile` and parts of `apps/web` currently consume tRPC contracts from `@norish/api/trpc`, coupling clients to API package internals and making dependency boundaries harder to reason about. Mobile typecheck has already been blocked by transitive server/workspace failures; web is exposed to the same boundary fragility. We need a clean extracted tRPC package that both server and clients consume directly.

## What Changes

- Extract tRPC router composition/types from `packages/api` into a standalone workspace package with a clean public surface.
- Make API server runtime consume the extracted package instead of defining router contracts inside `@norish/api`.
- Update mobile and web tRPC provider/client typing to import `AppRouter` and related client-safe types from the extracted package boundary.
- Add independent typecheck wiring so `apps/mobile` can pass `pnpm exec tsc --noEmit` without traversing unrelated API/auth/queue source errors.
- Migrate remaining workspace imports from `@norish/api/trpc` to the new package (or API-local internal paths where appropriate), then remove the old `@norish/api/trpc` path.
- Ensure workspace build/typecheck targets pass after migration, not just mobile in isolation.

## Capabilities

### New Capabilities

- `mobile-trpc-type-boundary`: Provides a standalone tRPC contract/runtime boundary consumed by both API server and clients without importing API internals.

### Modified Capabilities

- `mobile-trpc-integration`: Update mobile tRPC integration requirements to consume router types from the extracted standalone tRPC package.
- `web-trpc-integration`: Update web tRPC integration requirements to consume router/runtime contracts from the extracted standalone tRPC package.

## Impact

- Affected workspaces: new extracted tRPC workspace package (name finalized in design), `packages/api`, `apps/mobile`, `apps/web`, and any workspace package still importing `@norish/api/trpc`.
- Build/typecheck behavior: mobile typechecking becomes isolated from unrelated API/auth/queue source compilation failures.
- CI reliability: fewer false-negative client checks and clearer dependency ordering for server/client type contracts.
- Runtime behavior: no expected behavior change for connect/login/register/authenticated tRPC calls.

## Acceptance Criteria

- No `any` cast at mobile or web tRPC call sites.
- Mobile and web providers remain strongly typed with `AppRouter` from the extracted package boundary.
- `apps/mobile` typecheck passes under the new boundary without transitive server-source failures.
- `apps/web` typecheck/build passes with extracted-package integration.
- Workspace build/typecheck targets pass after migration.
- Existing runtime behavior for connect/login/register/authenticated flows remains unchanged.
