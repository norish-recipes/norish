## 1. Audit and contracts

- [x] 1.1 Build the mutation acknowledgement audit matrix covering all appRouter mutations with ack class (`awaited` / `fire-and-forget` / `enqueue`), target class, and receipt eligibility.
- [x] 1.2 Fix delayed-delivery allowlist entries that reference non-existent `recurringGroceries.*` paths (real paths are `groceries.*`).
- [x] 1.3 Add the allowlist-accuracy walking test (existence, mutation type, version contracts, no overlap, classification completeness, shrink-only fire-and-forget set).
- [x] 1.4 Define the `MutationAck` contract (`packages/shared/src/contracts/mutation-ack.ts`) with `appliedAck`/`staleAck` helpers and export it from contracts.
- [x] 1.5 Add characterization tests for the highest-risk fire-and-forget procedures (`groceries.update`, households) documenting current return-before-write behavior.

## 2. Truthful conversions (risk-ascending)

- [x] 2.1 Convert `ratings.rate`; establish the conversion recipe, update output typing and tests.
- [ ] 2.2 Add the scoped `@typescript-eslint/no-floating-promises` guardrail for `packages/trpc/src/routers/**` with justified disables.
- [x] 2.3 Convert `stores.delete`.
- [x] 2.4 Convert `groceries.update`, `groceries.reorderInStore`, `groceries.markAllDone`, `groceries.deleteDone` (+ output schemas).
- [x] 2.5 Convert `groceries.updateRecurring`, `groceries.detachRecurring`, `groceries.deleteRecurring`, `groceries.checkRecurring`; remove `flushAsync` hacks from recurring tests.
- [x] 2.6 Convert `recipes.create` (keeps string return), `recipes.update`, `recipes.delete`, `recipes.convertMeasurements`.
- [x] 2.7 Convert `households.create/join/leave/kick/regenerateCode/transferAdmin` with awaited cache invalidation and deferred connection termination.
- [x] 2.8 Retire `failed` event emission from converted mutations; verify hooks single-report errors.
- [ ] 2.9 Formalize `archive.importArchive` enqueue contract (`{ success: true, status: "accepted", total }`).

## 3. Client reconciliation

- [x] 3.1 Add `stale`-flag reconciliation (`if (result.stale) invalidate()`) to shared-react mutation hooks where missing.
- [x] 3.2 Add hook tests proving optimistic render appears immediately and rolls forward/back on applied, stale, and thrown-error outcomes.

## 4. Verification

- [x] 4.1 Update the audit matrix and the shrink-only test list as each router converts.
- [ ] 4.2 Run per-package suites (`@norish/trpc`, `@norish/shared`, `@norish/shared-react`, apps) and docker integration; confirm no `flushAsync` remains.
