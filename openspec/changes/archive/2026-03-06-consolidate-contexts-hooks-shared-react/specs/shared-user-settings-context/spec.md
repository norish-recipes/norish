## ADDED Requirements

### Requirement: Shared user settings context factory is provided from shared-react

The system SHALL expose a `createUserSettingsContext` factory from `@norish/shared-react/contexts` that creates a user settings provider and hook, accepting platform-specific adapters for user query, mutations, and error handling.

#### Scenario: Web creates user settings context with all adapters

- **WHEN** the web app calls `createUserSettingsContext` with user query, mutations, and toast/error adapters
- **THEN** the returned `UserSettingsProvider` and `useUserSettingsContext` SHALL function identically to the current web implementation

### Requirement: User settings context error handling uses adapter injection

The factory SHALL NOT directly import platform toast libraries. Error toast calls SHALL be delegated to an injected error handler adapter.

#### Scenario: Error adapter handles platform differences

- **WHEN** a user settings mutation fails
- **THEN** the error notification SHALL be dispatched through the injected error handler
- **AND** the shared context module SHALL NOT import `next-intl` or `@heroui/react` directly
