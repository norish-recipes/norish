## ADDED Requirements

### Requirement: Shared household context factory is provided from shared-react

The system SHALL expose a `createHouseholdContext` factory from `@norish/shared-react/contexts` that creates a household provider and hook pair, accepting platform-specific adapters for household data queries and subscriptions.

#### Scenario: Web creates household context with query and subscription adapters

- **WHEN** the web app calls `createHouseholdContext` with `useHouseholdQuery` and `useHouseholdSubscription` adapters
- **THEN** the returned `HouseholdProvider` and `useHouseholdContext` SHALL function identically to the current web household context

#### Scenario: Mobile creates household context with its own adapters

- **WHEN** the mobile app calls `createHouseholdContext` with its own adapters
- **THEN** the returned `HouseholdProvider` SHALL function correctly with mobile-specific implementations

### Requirement: Household context core logic is platform-safe

The shared household context factory SHALL NOT import platform-specific modules. All platform dependencies (including subscription handlers that use toasts) SHALL be injected through adapters.

#### Scenario: Shared logic avoids platform-only dependencies

- **WHEN** shared-react household context modules are evaluated in both web and mobile builds
- **THEN** they SHALL NOT require browser-only or native-only modules
