## 1. Boundary Inventory and Ownership Decisions

- [x] 1.1 Inventory all `@norish/trpc` imports and identify server-only behaviors that currently rely on `@norish/api/*` internals.
- [x] 1.2 Define final ownership per router domain (`trpc` owns router/procedures/contracts, `api` owns endpoint hosting).
- [x] 1.3 Confirm dependency direction in manifests (`api -> trpc`, no `trpc -> api`) and remove manifest back-edge declarations.

## 2. Clean-Cut Utility Relocation (No Shims/Re-exports)

- [x] 2.1 Create `@norish/shared-server` package and baseline exports for server-only shared utilities consumed by API/TRPC.
- [x] 2.2 Move TRPC logging usage to `@norish/shared-server/logger` and rewrite API/TRPC imports directly.
- [x] 2.3 Move downloader/media helpers required by TRPC to `@norish/shared-server/media/storage` and `@norish/shared-server/media/avatar-cleanup`, then update direct consumers.
- [x] 2.4 Move recipe randomizer + admin default-config helpers required by TRPC to `@norish/shared-server/recipes/randomizer` and `@norish/shared-server/config/defaults`, then update imports.
- [x] 2.5 Move archive/caldav/AI helpers required by TRPC to `@norish/shared-server/archive/parser`, `@norish/shared-server/caldav/*`, and `@norish/shared-server/ai/*`, then update imports.
- [x] 2.6 Remove every `@norish/api/*` import from `packages/trpc/src/**` with no temporary bridges.

## 2b. Shared Safety Rules

- [x] 2.7 Ensure code moved to `@norish/shared-server` is server-only and boundary-safe for API/TRPC consumers.
- [x] 2.8 Enforce placement rule: code consumed only by server packages stays in `@norish/shared-server` even if client-safe; only intentionally client-consumed modules belong in `@norish/shared` exports.

## 3. API Hosting Boundary Verification

- [x] 3.1 Ensure API route adapters host `/trpc` and websocket runtime from `@norish/trpc` only.
- [x] 3.2 Verify TRPC remains router/procedure source of truth and API stays transport host.

## 4. Validation and Closeout

- [x] 4.1 Run dependency checks (`pnpm run deps:cycles` and `pnpm run deps:workspace`) and fix regressions.
- [x] 4.2 Run compile checks (`pnpm run typecheck:mobile` and `pnpm run build`) and resolve regressions.
- [x] 4.3 Run targeted auth/api/web smoke checks and confirm parity.
- [x] 4.4 Re-evaluate `apps/mobile/declarations.d.ts` (`declare module 'server-only';`) based on typecheck results.
- [x] 4.5 Document final boundary decisions and validation outcomes in migration notes.
