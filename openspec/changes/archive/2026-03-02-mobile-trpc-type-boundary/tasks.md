## 1. Extract Standalone tRPC Package

- [x] 1.1 Create a new standalone workspace package for tRPC router composition and public types (name per workspace conventions).
- [x] 1.2 Move router composition/types from `packages/api` into the new package without changing procedure runtime behavior.
- [x] 1.3 Define strict export map: expose `AppRouter` and approved client-facing types, keep server-only internals private.

## 2. API + Client Integration Migration

- [x] 2.1 Update API runtime wiring to import router/runtime pieces from the extracted package.
- [x] 2.2 Update `apps/mobile` tRPC provider/client typing imports to use `AppRouter` from the extracted package.
- [x] 2.3 Update `apps/web` tRPC provider/runtime/type imports to consume the extracted package entrypoints.
- [x] 2.4 Migrate remaining workspace imports (`packages/auth`, `packages/queue`, tests/mocks, and utilities) off deprecated `@norish/api/trpc` paths.
- [x] 2.5 Verify compile-time inference at representative mobile/web/auth/config procedure call sites still resolves expected typed inputs/outputs.

## 3. Typecheck, Build, and CI Integrity

- [x] 3.1 Update workspace scripts/Turbo pipeline so mobile typecheck depends on extracted package artifacts, not full API source traversal.
- [x] 3.2 Keep/add a mobile-focused typecheck validation step (`apps/mobile` scope) that can run independently when unrelated server/workspace errors exist.
- [x] 3.3 Add CI validation that `apps/web` typecheck/build succeeds with extracted package integration.
- [x] 3.4 Add CI guard against new imports from deprecated `@norish/api/trpc` path after migration.
- [x] 3.5 Add/adjust workspace build gate so all migrated workspaces compile successfully after extraction.

## 4. Verification, Migration Notes, and Rollback Readiness

- [x] 4.1 Run validation: `apps/mobile` typecheck passes under new boundary and fails only for mobile/contract-local issues.
- [x] 4.2 Run validation: `apps/web` integration compiles/types correctly using extracted package contracts.
- [x] 4.3 Run workspace build/typecheck verification and confirm all migrated packages build successfully.
- [x] 4.4 Run smoke verification for connect/login/register/authenticated flows (mobile + web) and confirm runtime behavior is unchanged.
- [x] 4.5 Remove deprecated `@norish/api/trpc` export path (or keep a short-lived compatibility bridge) and document migration notes.
