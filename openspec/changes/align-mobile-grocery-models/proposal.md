## Why

The mobile grocery UI uses a custom view-model layer (`GroceryItem`, `GroceryRowModel`, `GrocerySectionModel`) that re-shapes backend DTOs into flattened, string-formatted types. The web UI works directly with `GroceryDto` and `StoreDto` from `@norish/shared/contracts`. This divergence means interaction handlers (toggle, delete, edit, reorder) must be written separately for each platform and cannot be lifted into `shared-react` hooks.

Aligning mobile to use the same DTO-based approach as web is a prerequisite for unifying grocery interaction logic into shared hooks.

## What Changes

- **Remove** the mobile-only view-model types (`GroceryItem`, `GroceryRowModel`, `GrocerySectionModel`, `GroceryStore`) from `grocery-view-models.ts`
- **Remove** the mapping functions (`mapGroceriesToRows`, `mapStoresToGroceryStores`) that convert DTOs into view-model types
- **Delete** `grocery-mock-data.ts` entirely (duplicate types + hardcoded mock arrays, no longer referenced by live code)
- **Refactor** mobile grocery components to accept `GroceryDto`, `StoreDto`, and `RecurringGroceryDto` directly:
  - `groceries-screen.tsx` — work with raw DTOs, remove the mapping layer
  - `grocery-section-card.tsx` — accept `GroceryDto[]` + store metadata instead of `GrocerySectionModel`
  - `grocery-row.tsx` — accept `GroceryDto` instead of `GroceryRowModel`
  - `sortable-grocery-list.tsx` — accept `GroceryDto[]` instead of `GroceryRowModel[]`
  - `grocery-editor-sheet.tsx` — accept `StoreDto[]` instead of `GroceryStore[]`
  - `groceries-menu.tsx` — import `GroceryViewMode` from context instead of view-models
- **Keep** the sorting/splitting utilities (`sortByCompletion`, `splitSectionItems`) in a slimmed-down utils file, operating on `GroceryDto` directly
- **Keep** the section-building logic (`buildStoreSections`, `buildRecipeSections`) but refactor to operate on `GroceryDto[]` + `StoreDto[]` + `RecipeMap` without intermediate types

## Capabilities

### New Capabilities

_None — this is a refactor of existing UI to use existing contracts._

### Modified Capabilities

- `shared-groceries-context`: The mobile groceries context and screen no longer depend on a view-model mapping layer; components consume DTOs directly, matching the web pattern

## Impact

- **Mobile components**: `groceries-screen.tsx`, `grocery-section-card.tsx`, `grocery-row.tsx`, `sortable-grocery-list.tsx`, `grocery-editor-sheet.tsx`, `groceries-menu.tsx`
- **Mobile lib**: `grocery-view-models.ts` (heavy rewrite), `grocery-mock-data.ts` (delete)
- **Mobile context**: `groceries-context.tsx` (minor — `GroceryViewMode` source changes)
- **No backend changes**: All shared contracts, tRPC routers, and hooks remain untouched
- **No web changes**: Web already uses the target pattern
