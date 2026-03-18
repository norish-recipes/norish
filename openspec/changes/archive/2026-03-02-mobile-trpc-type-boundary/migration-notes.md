# mobile-trpc-type-boundary migration notes

## New package boundary

- Introduced `@norish/trpc` as the shared import boundary for mobile, web, auth, queue, and API runtime wiring.
- Added dedicated entrypoints:
  - `@norish/trpc` for client-safe contract types (`AppRouter` and approved DTO/event types)
  - `@norish/trpc/server` for server runtime wiring (`appRouter`, `createContext`, websocket init, core tRPC helpers)
  - targeted server utilities/subpaths used by migrated workspaces (`helpers`, `connection-manager`, selected `routers/*` exports)

## Import migration

- Migrated workspace consumers from `@norish/api/trpc` to `@norish/trpc` in:
  - `apps/mobile`
  - `apps/web`
  - `packages/auth`
  - `packages/queue`
  - API tests/mocks and API-side utility usage that referenced deprecated paths

## Deprecated import guard

- Added guardrail script `tooling/monorepo/scripts/check-deprecated-trpc-imports.mjs`.
  - This blocks any new `@norish/api/trpc` imports outside allowlisted migration guard files.

## Bridge removal

- Removed legacy `packages/api/src/trpc` implementation folder.
- Removed `@norish/api` package `./trpc` export and `packages/api/src/trpc.ts` bridge entrypoint.
- Moved full tRPC runtime/router implementation into `packages/trpc/src` (no runtime re-export bridge remains in `@norish/api`).

## Validation wiring

- Added mobile-focused validation command: `pnpm run typecheck:mobile`.
- Updated `@norish/trpc` typecheck/build scripts to emit fresh declaration artifacts (`dist/**`) before mobile typecheck.
- Added mobile-side ambient declaration for `server-only` to prevent unrelated server package typing noise during strict mobile checks.
- Added CI checks for:
  - web typecheck/build integration
  - deprecated import guard
  - migrated workspace validation suite
