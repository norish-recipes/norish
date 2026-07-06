## 0. Pre-Phase UI Fix

- [x] 0.1 Update `GroceryRecurrenceSheet` to open at a full-height detent.
- [x] 0.2 Replace recurrence boolean-only state with typed recurrence settings covering enabled state and weekly, biweekly, and monthly frequency.
- [x] 0.3 Ensure closing or confirming the recurrence panel returns to the editor with item text, selected store, and recurrence settings preserved.
- [x] 0.4 Verify create and edit editor modes still reset or hydrate form state correctly after the recurrence flow change.

## 1. Shared Mobile Adapters

- [x] 1.1 Add a mobile groceries hooks wrapper around `createGroceriesHooks({ useTRPC })` using the mobile tRPC binding.
- [x] 1.2 Add or complete mobile groceries context/provider wiring using shared-react groceries context adapters if required by the mobile screen structure.
- [x] 1.3 Add mobile error/toast adapter behavior for shared groceries subscription failure events.
- [x] 1.4 Tighten shared groceries hook types needed by mobile without adding `any` or type suppression at mobile call sites.

## 2. Read Flow

- [x] 2.1 Replace `GroceriesScreen` mock grocery state with backend data from shared groceries query and subscription hooks.
- [x] 2.2 Add a mapper from backend grocery, recurring grocery, store, and recipe metadata into the existing mobile row and section models.
- [x] 2.3 Preserve store and recipe view mode grouping with backend-backed data.
- [x] 2.4 Add mobile loading, empty, and error states for the groceries screen.
- [x] 2.5 Remove direct dependency on `grocery-mock-data.ts` from production mobile groceries rendering once backend data is wired.

## 3. Write Flow

- [x] 3.1 Wire one-off grocery done and undone toggles to `toggleGroceries` with version-aware shared mutation behavior.
- [x] 3.2 Wire recurring grocery done and undone toggles to `toggleRecurringGrocery` with grocery and recurring versions.
- [x] 3.3 Preserve the delayed completed-item sorting animation by keeping `frozenIds` as mobile-only transient state.
- [x] 3.4 Verify subscription updates reconcile correctly after local done and undone mutations.

## 4. Create, Edit, Delete Flow

- [x] 4.1 Wire create-one-off submissions to `createGrocery` with item text and selected store.
- [x] 4.2 Map recurrence sheet frequency settings to `RecurrencePattern` and wire recurring submissions to `createRecurringGrocery`.
- [x] 4.3 Wire one-off editing to `updateGrocery` and `assignGroceryToStore` when item text or store changes.
- [x] 4.4 Wire recurring editing to `updateRecurringGrocery`, including disabling recurrence by passing a null recurrence pattern.
- [x] 4.5 Wire swipe and editor delete actions to `deleteGroceries` for one-off rows and `deleteRecurringGrocery` for recurring rows.
- [x] 4.6 Ensure editor close/reset behavior remains correct after successful create, edit, and delete actions.

## 5. Remaining Interaction Gaps

- [ ] 5.1 Wire supported store-section reorder actions to `reorderGroceriesInStore`.
- [ ] 5.2 Disable or clearly avoid persisting unsupported reorder contexts, especially recipe-group reorder if backend semantics are not defined.
- [ ] 5.3 Ensure the add-grocery entry point from the mobile shell opens the backend-backed create editor.
- [ ] 5.4 Confirm recurring rows display enough state for users to understand active recurrence after backend wiring.

## 6. Verification

- [ ] 6.1 Add or update focused tests for recurrence sheet state restoration and frequency mapping.
- [ ] 6.2 Add or update focused tests for mobile grocery view-model mapping from backend DTOs.
- [ ] 6.3 Run the relevant mobile TypeScript, lint, and test commands for changed workspaces.
- [ ] 6.4 Manually verify read, subscription, done/undone, create, edit, delete, recurring, and reorder behavior in the mobile app.
