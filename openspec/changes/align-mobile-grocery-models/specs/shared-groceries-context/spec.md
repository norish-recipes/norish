## MODIFIED Requirements

### Requirement: Shared groceries context factory is provided from shared-react

The system SHALL expose a `createGroceriesContext` factory from `@norish/shared-react/contexts` that creates a groceries data provider, UI provider, and hooks, accepting platform-specific adapters for query, mutations, subscription, and storage. Mobile consumers SHALL work with `GroceryDto`, `StoreDto`, and `RecurringGroceryDto` from `@norish/shared/contracts` directly — without platform-specific intermediate view-model types.

#### Scenario: Web creates groceries context with all adapters

- **WHEN** the web app calls `createGroceriesContext` with query, mutations, subscription, and localStorage adapters
- **THEN** the returned `GroceriesContextProvider`, `useGroceriesContext`, and `useGroceriesUIContext` SHALL function identically to the current web implementation

#### Scenario: Mobile groceries screen consumes DTOs directly

- **WHEN** the mobile groceries screen renders its grocery list
- **THEN** all components (section cards, rows, sortable lists, editor sheets) SHALL accept `GroceryDto`, `StoreDto`, and `RecurringGroceryDto` as props without any intermediate mapping layer

#### Scenario: Mobile grocery interaction handlers operate on DTOs

- **WHEN** a user toggles, deletes, edits, or reorders a grocery on mobile
- **THEN** the handler SHALL operate directly on `GroceryDto` fields (e.g., `isDone`, `id`, `recurringGroceryId`, `version`) without translating from view-model fields

### Requirement: Groceries context separates data and UI concerns

The factory SHALL produce separate data and UI context values, matching the current split-context pattern.

#### Scenario: Data and UI contexts are independently accessible

- **WHEN** a consumer needs grocery data (items, mutations)
- **THEN** it SHALL use `useGroceriesContext` without triggering re-renders from UI state changes

## ADDED Requirements

### Requirement: Mobile grocery section-building uses shared types

The mobile app SHALL provide section-building utility functions (`buildStoreSections`, `buildRecipeSections`) that accept `GroceryDto[]`, `StoreDto[]`, and `RecipeMap` and produce sections containing `GroceryDto[]` items without intermediate type conversions.

#### Scenario: Store sections built from DTOs

- **WHEN** `buildStoreSections` is called with `GroceryDto[]`, `StoreDto[]`, `RecipeMap`, and optional `frozenIds`
- **THEN** it SHALL return sections grouped by store, each containing the original `GroceryDto` objects sorted by completion status and sort order

#### Scenario: Recipe sections built from DTOs

- **WHEN** `buildRecipeSections` is called with `GroceryDto[]`, `StoreDto[]`, and `RecipeMap`
- **THEN** it SHALL return sections grouped by recipe, each containing the original `GroceryDto` objects, with an "uncategorized" section for groceries not linked to any recipe

### Requirement: No mobile-only grocery view-model types

The mobile app SHALL NOT define platform-specific grocery view-model types (`GroceryItem`, `GroceryRowModel`, `GrocerySectionModel`, `GroceryStore`). All grocery data representation SHALL use the shared contract types from `@norish/shared/contracts`.

#### Scenario: Mock data file is removed

- **WHEN** the mobile app is built
- **THEN** `grocery-mock-data.ts` SHALL NOT exist in the mobile source tree

#### Scenario: View-model mapping functions are removed

- **WHEN** the mobile groceries screen prepares data for display
- **THEN** it SHALL NOT call `mapGroceriesToRows` or `mapStoresToGroceryStores` — data flows directly from query hooks to components
