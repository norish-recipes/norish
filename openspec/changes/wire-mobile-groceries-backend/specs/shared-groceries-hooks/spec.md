## ADDED Requirements

### Requirement: Shared groceries hooks support mobile backend wiring

The shared groceries hook family SHALL expose enough typed query, mutation, cache, and subscription behavior for the mobile app to wire its groceries screen without direct tRPC grocery calls in UI components.

#### Scenario: Mobile creates groceries hooks from tRPC binding

- **WHEN** the mobile app creates its groceries hook wrapper with the mobile tRPC binding
- **THEN** the wrapper resolves `useGroceriesQuery`, `useGroceriesMutations`, `useGroceriesCache`, and `useGroceriesSubscription`
- **AND** mobile grocery UI components can consume those hooks through mobile-owned adapters

#### Scenario: Mobile mutation surface covers grocery editor operations

- **WHEN** the mobile app uses shared groceries mutations for editor actions
- **THEN** the mutation surface supports create, update, delete, toggle, recurring create, recurring update, recurring delete, recurring toggle, store assignment, and supported store reorder operations
- **AND** failed mutations invalidate the shared groceries query instead of leaving mobile-only stale state

#### Scenario: Mobile subscriptions reconcile grocery events

- **WHEN** the backend emits grocery created, updated, deleted, recurring created, recurring updated, recurring deleted, or grocery failure events
- **THEN** the shared subscription hook updates or invalidates the shared groceries cache for mobile consumers

### Requirement: Shared groceries hooks remain platform agnostic

The shared groceries hooks SHALL NOT import React Native, Expo, browser-only, or app-specific modules when supporting mobile groceries wiring.

#### Scenario: Shared hooks stay adapter-based

- **WHEN** mobile-specific UI state, native sheets, toasts, or storage behavior is needed
- **THEN** that behavior is provided by mobile adapters or mobile components
- **AND** `@norish/shared-react` groceries hooks remain platform-neutral
