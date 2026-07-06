## 1. Replace utility file and remove dead code

- [x] 1.1 Delete `apps/mobile/src/lib/groceries/grocery-mock-data.ts`
- [x] 1.2 Rewrite `apps/mobile/src/lib/groceries/grocery-view-models.ts` → `grocery-utils.ts`: remove all custom types (`GroceryItem`, `GroceryRowModel`, `GrocerySectionModel`, `GroceryStore`, `GroceryViewMode`), keep `STORE_COLOR_TINTS` / `storeTintColor`, rewrite `buildStoreSections` and `buildRecipeSections` to accept `GroceryDto[]` + `StoreDto[]` + `RecipeMap` and return `GrocerySection` (with `items: GroceryDto[]`), keep `splitSectionItems` operating on `GroceryDto`, keep `sortByCompletion` operating on `GroceryDto`

## 2. Update groceries context

- [x] 2.1 Move `GroceryViewMode` type definition into `apps/mobile/src/context/groceries-context.tsx` (currently imported from view-models)

## 3. Refactor grocery-row component

- [x] 3.1 Change `grocery-row.tsx` to accept `GroceryDto` (+ `RecurringGroceryDto | null` + `recipeName: string | null`) instead of `GroceryRowModel`. Replace `item.completed` → `item.isDone`, `item.amount` (string) → inline format of `item.amount` (number) + `item.unit`, `item.recurring` → prop-based recurring flag, `item.contextLabel` → `recipeName` / store name prop

## 4. Refactor sortable-grocery-list component

- [x] 4.1 Change `sortable-grocery-list.tsx` to accept `GroceryDto[]` instead of `GroceryRowModel[]` for both `sortableItems` and `doneItems`. Update `SortableRenderItemProps` generic from `GroceryRowModel` to `GroceryDto`. Pass through `RecurringGroceryDto[]` and `RecipeMap` / store context so `GroceryRow` can receive the data it needs

## 5. Refactor grocery-section-card component

- [x] 5.1 Change `grocery-section-card.tsx` to accept the new `GrocerySection` type (with `items: GroceryDto[]`) instead of `GrocerySectionModel`. Update `splitSectionItems` call to use `isDone` instead of `completed`. Pass `RecurringGroceryDto[]` and `RecipeMap` through to `SortableGroceryList`

## 6. Refactor groceries-screen component

- [x] 6.1 Remove the `mapGroceriesToRows` and `mapStoresToGroceryStores` mapping steps. Feed `groceriesQuery.groceries` and `storesQuery.stores` directly into `buildStoreSections` / `buildRecipeSections`. Update `handleToggleItem`, `handleDeleteItem`, `handlePressItem`, and `handleSaveEditingItem` to work with `GroceryDto` instead of `GroceryRowModel` / `GroceryItem`. Update the `GroceryEditorSheet` call to pass `StoreDto[]` and derive initial values from `GroceryDto`

## 7. Refactor grocery-editor-sheet component

- [x] 7.1 Change `grocery-editor-sheet.tsx` to accept `StoreDto[]` instead of `GroceryStore[]`. Filter stores by `id !== "unsorted"` is no longer needed (real stores don't have an "unsorted" entry). Use `storeTintColor(store)` for chip colours. Update the store chip rendering to use `StoreDto` fields

## 8. Update groceries-menu component

- [x] 8.1 Change `groceries-menu.tsx` to import `GroceryViewMode` from the groceries context instead of from the deleted view-models file

## 9. Verify and clean up

- [x] 9.1 Run `pnpm typecheck --filter @norish/mobile` to confirm no type errors across the mobile app
- [ ] 9.2 Verify the mobile grocery screen renders correctly: store view, recipe view, toggle, delete, edit, reorder all work as before
