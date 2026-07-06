## Context

The mobile Groceries screen currently builds store and recipe sections from `grocery-mock-data.ts` and keeps edits in local component state. The editor and recurrence sheets already model the intended mobile flow, but recurrence is only a boolean toggle, the recurrence sub-sheet opens at a medium detent, and returning from recurrence to editing does not fully preserve selected recurrence settings.

The shared React groceries hook family exists in `packages/shared-react/src/hooks/groceries/**` and already wraps the backend query, mutations, optimistic cache updates, and subscriptions. The backend is assumed ready, so this change should primarily add mobile adapters and replace mock state with shared hook/context state.

## Goals / Non-Goals

**Goals:**

- Fix the recurrence sheet UX before backend wiring: full-height presentation, explicit recurrence settings, and return to the editor with chosen settings preserved.
- Wire mobile groceries read state to shared groceries hooks, including subscriptions, loading, empty, and error handling.
- Wire done/undone actions to backend mutations while preserving the current delayed completed-item sorting animation.
- Wire create, edit, delete, store assignment, and recurrence operations to shared mutations.
- Keep mobile-specific row, sheet, swipe, grouping, and reorder interactions inside `apps/mobile`.

**Non-Goals:**

- Add new grocery backend routes, database columns, or event types.
- Rebuild the mobile grocery visual design beyond the recurrence panel sizing/state fix.
- Add offline outbox support for groceries unless existing shared/mobile infrastructure already makes it automatic.
- Change the web groceries implementation except where a shared hook/context contract fix is needed.

## Decisions

1. Use shared groceries hooks as the mobile data boundary.

   The mobile app should create a mobile-specific wrapper around `createGroceriesHooks({ useTRPC })`, following the web wrapper pattern but using mobile tRPC/provider adapters. This avoids duplicating grocery cache and subscription logic in `apps/mobile` and keeps backend event reconciliation in one shared package.

   Alternative considered: call tRPC directly from `GroceriesScreen`. That would be faster for the first read path but would fork mutation/subscription behavior from web and make recurrence and optimistic updates harder to keep consistent.

2. Introduce mobile mapping from backend DTOs to existing row/section models.

   The current UI is structured around `GroceryRowModel`, section cards, swipeable rows, and store/recipe group builders. Implementation should replace mock data with a mapper that turns shared `GroceryDto`, `RecurringGroceryDto`, store data, and recipe metadata into those view models, so most presentational components remain stable.

   Alternative considered: rewrite components to render DTOs directly. That would couple mobile UI to backend shape and increase churn in components that are already useful.

3. Keep optimistic UI through shared mutations, with mobile-only animation state layered on top.

   Shared mutations should own cache changes and invalidation on error. Mobile should keep only transient UI state such as `frozenIds`, active editor item, active sheet, and selected view mode.

   Alternative considered: keep a mobile mirror of grocery state and reconcile subscriptions into it. That risks stale data and duplicate conflict behavior.

4. Model recurrence selection as settings, not only a boolean.

   The recurrence sheet should return a recurrence settings value that can be converted to the shared `RecurrencePattern` used by create/update recurring mutations. Initial implementation can expose the existing weekly, biweekly, and monthly choices, mapping them to recurrence rule/interval values.

   Alternative considered: only persist the current boolean and default all enabled recurrence to weekly. That would keep UI simple but contradicts the existing frequency choices shown in the sheet.

5. Treat recurring grocery edits as recurrence-aware mutation routing.

   When editing an item tied to a recurring grocery, saving with recurrence enabled should call `updateRecurringGrocery`; saving with recurrence disabled should remove recurrence through `updateRecurringGrocery(..., null)`. Creating with recurrence enabled should call `createRecurringGrocery`; otherwise call `createGrocery`. Deleting a recurring item should delete the recurring grocery when the row represents that recurring relationship.

   Alternative considered: always call one-off grocery mutations and ignore recurring relationships. That would break recurrence state and subscription consistency.

## Risks / Trade-offs

- [Risk] Shared groceries hooks currently contain `any` in subscription handlers and may not expose every mobile-needed type cleanly. -> Mitigation: tighten shared types only where needed and avoid type suppression in mobile wrappers.
- [Risk] Mobile store data may not be available through the groceries hook result. -> Mitigation: use the existing shared store hooks/context if present, or add a small mobile adapter that consumes the existing backend/store hook without changing the grocery API.
- [Risk] Subscription events can reorder rows while a done/undone animation is in progress. -> Mitigation: keep `frozenIds` local and apply it during view-model sorting, independent of the shared cache source.
- [Risk] Recurrence settings in the sheet may outgrow the three current presets. -> Mitigation: store settings in a small typed value that maps to `RecurrencePattern`, so future presets can be added without changing editor state shape.
- [Risk] Reorder behavior may differ by backend capabilities for store and recipe grouping. -> Mitigation: implement backend-backed reorder only where the existing `reorderInStore` mutation applies, and leave unsupported grouping reorder disabled or local-only until a backend route exists.

## Migration Plan

- Phase 0: Fix recurrence panel height and state restoration while the screen still uses mock data.
- Phase 1: Add mobile shared groceries hook/context adapters and replace mock read state with backend query/subscription data.
- Phase 2: Wire mark done/undone, including recurring completion and delayed sorting behavior.
- Phase 3: Wire create, edit, delete, store assignment, and recurrence mutations.
- Phase 4: Fill gaps found during integration, such as empty/error states, unsupported reorder handling, and tests.

Rollback is straightforward because the change is isolated to mobile groceries wiring and shared adapter surface: revert mobile usage back to mock data or gate backend-backed groceries behind a local feature toggle if implementation needs to be split.

## Open Questions

- Should deleting a row linked to a recurring grocery always delete the recurring grocery, or should mobile offer a one-time occurrence delete option later?
- Should mobile reorder be limited to store grouping until recipe-group reorder semantics are defined?
