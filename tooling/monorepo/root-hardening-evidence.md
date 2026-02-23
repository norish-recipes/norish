# Root Hardening Evidence

Change: `update-monorepo-root-hardening-completion` (task 3)

## Root test migration progress

- Root `__tests__` file count (before): 169
- Root `__tests__` file count (current): 0
- Migrated test files in this wave: 169
- Destination workspaces:
  - `@norish/web`: `apps/web/__tests__/` (164 files)
  - `@norish/api`: `packages/api/__tests__/` (5 files)

## Temporary dependency exception burn-down

- Dependency exception count in `tooling/monorepo/root-hygiene-policy.json` (before): 14
- Dependency exception count in `tooling/monorepo/root-hygiene-policy.json` (current): 0
- Remaining unresolved root dependency exceptions: none

## Dependency ownership transfer

- Test-oriented dependencies moved to `apps/web/package.json` (`devDependencies`):
  - `@testcontainers/postgresql`
  - `@testing-library/dom`
  - `@testing-library/jest-dom`
  - `@testing-library/react`
  - `bullmq`
  - `drizzle-orm`
  - `jszip`
  - `pg`
  - `testcontainers`
  - `zod`
- Test-runner dependency added to `packages/api/package.json` (`devDependencies`):
  - `vitest`
- Root `package.json` removed now-unused test/runtime devDependencies previously justified by root tests.
- Root hygiene policy now reflects this ownership shift by:
  - removing root `__tests__` from allowed root directories
  - setting `dependencyExceptions` to an empty list

## Deferred remainder

- Deferred root test migration remainder: none
- Deferred exception removal remainder: none
