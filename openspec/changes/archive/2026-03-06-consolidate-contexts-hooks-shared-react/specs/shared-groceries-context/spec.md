## ADDED Requirements

### Requirement: Shared groceries context factory is provided from shared-react

The system SHALL expose a `createGroceriesContext` factory from `@norish/shared-react/contexts` that creates a groceries data provider, UI provider, and hooks, accepting platform-specific adapters for query, mutations, subscription, and storage.

#### Scenario: Web creates groceries context with all adapters

- **WHEN** the web app calls `createGroceriesContext` with query, mutations, subscription, and localStorage adapters
- **THEN** the returned `GroceriesContextProvider`, `useGroceriesContext`, and `useGroceriesUIContext` SHALL function identically to the current web implementation

### Requirement: Groceries context separates data and UI concerns

The factory SHALL produce separate data and UI context values, matching the current split-context pattern.

#### Scenario: Data and UI contexts are independently accessible

- **WHEN** a consumer needs grocery data (items, mutations)
- **THEN** it SHALL use `useGroceriesContext` without triggering re-renders from UI state changes
