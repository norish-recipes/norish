# shared-groceries-hooks Specification

## Purpose

Defines the shared React shared groceries hooks factory pattern in `@norish/shared-react`, enabling both web and mobile to consume this functionality through a common, app-agnostic factory/adapter pattern.

## Requirements

### Requirement: Shared React exposes reusable groceries hook family

`@norish/shared-react` SHALL expose a `createGroceriesHooks` factory that returns groceries query, mutation, cache, and subscription hooks using tRPC binding injection.

#### Scenario: Shared groceries hooks are available to both apps

- **WHEN** web and mobile import shared groceries hooks
- **THEN** both apps SHALL resolve the same shared-react hook factories
- **AND** shared groceries modules SHALL NOT import platform runtime modules

### Requirement: Groceries hook family includes query, mutation, cache, and subscription hooks

The `createGroceriesHooks` factory SHALL return hooks covering the grocery list lifecycle.

#### Scenario: Complete groceries hook family is returned

- **WHEN** an app calls `createGroceriesHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useGroceriesQuery`, `useGroceriesMutations`, `useGroceriesCache`, and `useGroceriesSubscription`

### Requirement: Platform-specific grocery hooks remain in app wrappers

Complex UI-interaction hooks like drag-and-drop sorting (`use-grouped-grocery-dnd`) SHALL remain as platform-specific app hooks since they depend on browser drag APIs.

#### Scenario: DnD hook stays in web app

- **WHEN** the groceries hook family is created in shared-react
- **THEN** `useGroupedGroceryDnd` SHALL NOT be included in the shared factory
- **AND** it SHALL remain in the web app's hooks directory
