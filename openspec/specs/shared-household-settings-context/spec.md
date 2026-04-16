# shared-household-settings-context Specification

## Purpose

Defines the shared React shared household settings context factory pattern in `@norish/shared-react`, enabling both web and mobile to consume this functionality through a common, app-agnostic factory/adapter pattern.

## Requirements

### Requirement: Shared household settings context factory is provided from shared-react

The system SHALL expose a `createHouseholdSettingsContext` factory from `@norish/shared-react/contexts` that creates a household settings provider and hook, composing household context data with household mutation adapters.

#### Scenario: Web creates household settings context

- **WHEN** the web app calls `createHouseholdSettingsContext` with `useHouseholdContext` and `useHouseholdMutations` adapters
- **THEN** the returned `HouseholdSettingsProvider` and `useHouseholdSettingsContext` SHALL function identically to the current web implementation
