## Context

The mobile grocery UI currently interposes a view-model layer between the shared backend DTOs and the React components. The web UI works directly with `GroceryDto`, `StoreDto`, and `RecurringGroceryDto` from `@norish/shared/contracts`. The mobile equivalent (`grocery-view-models.ts`) transforms these DTOs into custom types (`GroceryItem`, `GroceryRowModel`, `GrocerySectionModel`, `GroceryStore`) with lossy conversions (e.g., `amount` becomes a pre-formatted string, `isDone` becomes `completed`).

This divergence blocks the next step: lifting interaction handlers (toggle, delete, edit, reorder) into shared hooks in `@norish/shared-react`.

Additionally, `grocery-mock-data.ts` contains a second copy of the same types plus hardcoded mock arrays — a leftover from prototyping that is no longer used by live code paths.

## Goals / Non-Goals

**Goals:**
- Mobile grocery components accept the same `GroceryDto`, `StoreDto`, `RecurringGroceryDto` types as web
- Remove all mobile-only intermediate types (`GroceryItem`, `GroceryRowModel`, `GrocerySectionModel`, `GroceryStore`)
- Delete the dead `grocery-mock-data.ts` file
- Preserve all current mobile UX behaviour (sorting, completion animation, swipe-to-delete, drag-and-drop reorder)
- Keep reusable utility functions (sorting, section-building) in a slim utils file that operates on DTOs directly

**Non-Goals:**
- Moving interaction handlers to shared hooks (that's the follow-up change enabled by this one)
- Changing the web grocery implementation
- Modifying backend contracts, tRPC routers, or shared hooks
- Adding new features or changing grocery UX behaviour

## Decisions

### 1. Components take raw DTOs — no intermediate types

Components will accept `GroceryDto` directly instead of custom view-model types. Amount/unit formatting moves into the rendering component (mirroring how web's `GroceryItem` uses `useUnitFormatter`). The mobile equivalent will use a local format helper since the mobile unit formatter infrastructure differs.

**Why not keep a thin adapter?** Any adapter re-introduces a mapping step that handlers must reverse to call shared mutations. Direct DTO usage means handler code is identical between web and mobile — the entire point of this change.

### 2. Section-building utils remain as standalone functions

The `buildStoreSections` and `buildRecipeSections` functions are useful on mobile for building the collapsible card structure. They will be refactored to take `GroceryDto[]`, `StoreDto[]`, and `RecipeMap` as inputs and produce section models that reference `GroceryDto` items directly (no mapping). The output type becomes:

```ts
type GrocerySection = {
  id: string;
  title: string;
  tintColor: string;
  items: GroceryDto[];
};
```

These live in `apps/mobile/src/lib/groceries/grocery-utils.ts` (renamed from `grocery-view-models.ts`).

### 3. `GroceryViewMode` type moves to the groceries context

Currently defined in `grocery-view-models.ts`, this type will move to `groceries-context.tsx` where it is consumed. It has no dependency on view-model types.

### 4. Store tint colour mapping stays as a utility

The web handles store colours via CSS classes (`getStoreColorClasses`). Mobile needs runtime hex colours. The `STORE_COLOR_TINTS` map and `storeTintColor` helper remain in the utils file, operating on `StoreDto.color`.

### 5. `completed` → `isDone` field name alignment

Mobile components currently check `item.completed`. After this change they will check `item.isDone`, matching the DTO field name. This avoids any boolean-renaming confusion and means shared handler code works without translation.

## Risks / Trade-offs

- **Churn in all mobile grocery components** → Mitigated by being a pure refactor with no behaviour changes; each component's responsibility stays the same, only the prop types change.
- **Amount formatting logic duplicated between web and mobile** → Acceptable in the short term; a shared formatter can be introduced later. Mobile's inline formatter is simple (`formatAmountUnit(amount, unit) → string`).
- **Section model loses pre-computed `contextLabel`** → The recipe name / store name context label will be computed inline in the row component using the `RecipeMap` and store data passed through props/context, matching how web does it.
