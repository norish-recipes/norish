## ADDED Requirements

### Requirement: Shared household settings context factory is provided from shared-react

The system SHALL expose a `createHouseholdSettingsContext` factory from `@norish/shared-react/contexts` that creates a household settings provider and hook, composing household context data with household mutation adapters.

#### Scenario: Web creates household settings context

- **WHEN** the web app calls `createHouseholdSettingsContext` with `useHouseholdContext` and `useHouseholdMutations` adapters
- **THEN** the returned `HouseholdSettingsProvider` and `useHouseholdSettingsContext` SHALL function identically to the current web implementation
