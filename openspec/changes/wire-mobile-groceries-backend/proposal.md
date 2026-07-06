## Why

The mobile Groceries screen is still driven by mock data and local-only edits, so it cannot reflect household state, backend mutations, or real-time updates. The backend and shared React groceries hooks are ready; this change wires the mobile UI to that source of truth and fixes the recurrence sheet flow before data integration.

## What Changes

- Replace mobile groceries mock-data state with shared groceries query, mutation, cache, and subscription hooks backed by tRPC.
- Add mobile read flow for loading grocery items, recurring groceries, stores, recipe grouping metadata, loading, empty, and error states.
- Add mobile write flow for marking groceries done/undone, including recurring grocery completion behavior and subscription reconciliation.
- Add mobile create/edit/delete flow for one-off and recurring groceries, including recurrence configuration and store assignment.
- Fix the mobile recurrence panel so it opens at full height and returns to the previous editor panel with the selected recurrence settings intact.
- Preserve the current mobile grocery UX patterns: store/recipe grouping, swipe delete, row tap editing, delayed completed-item sorting, and section reorder behavior where supported.
- No breaking changes.

## Capabilities

### New Capabilities

- `mobile-groceries-backend`: Mobile groceries screen reads and mutates household grocery data through the shared tRPC-backed groceries hooks, including live subscription updates and recurrence-aware editing.

### Modified Capabilities

- `shared-groceries-hooks`: Mobile consumption of the shared hook family must support the create, update, delete, toggle, recurrence, assignment, reorder, and subscription operations needed by the native groceries UI.
- `shared-groceries-context`: Mobile consumption of the shared groceries context must preserve the split data/UI contract while allowing native sheet state and storage adapters.

## Impact

- Affected app code: `apps/mobile/src/components/groceries/**`, `apps/mobile/src/components/shell/sheet/grocery-*.tsx`, mobile grocery route/provider wiring, and mobile tRPC hook adapters.
- Affected shared code: `packages/shared-react/src/hooks/groceries/**` and groceries context exports/adapters as needed for mobile integration.
- Affected APIs: existing `groceries` tRPC queries, mutations, and subscriptions; no new backend endpoints expected.
- Affected behavior: grocery data becomes household-backed and live-synchronized instead of local mock state.
