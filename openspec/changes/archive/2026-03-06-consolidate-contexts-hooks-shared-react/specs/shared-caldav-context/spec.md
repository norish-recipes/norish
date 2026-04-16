## ADDED Requirements

### Requirement: Shared CalDAV settings context factory is provided from shared-react

The system SHALL expose a `createCaldavSettingsContext` factory from `@norish/shared-react/contexts` that creates a CalDAV settings provider and hook, accepting platform-specific adapters for CalDAV queries, mutations, subscription, and toast notifications.

#### Scenario: Web creates CalDAV settings context with all adapters

- **WHEN** the web app calls `createCaldavSettingsContext` with query, mutation, subscription, and toast adapters
- **THEN** the returned `CalDavSettingsProvider` and `useCalDavSettingsContext` SHALL function identically to the current web implementation

### Requirement: CalDAV context toast notifications use adapter injection

The factory SHALL NOT directly import platform toast libraries. Toast calls (success, error) SHALL be delegated to an injected toast adapter.

#### Scenario: Toast adapter handles platform differences

- **WHEN** a CalDAV operation succeeds or fails
- **THEN** the toast notification SHALL be dispatched through the injected adapter
- **AND** the shared context module SHALL NOT import `@heroui/react` or `next-intl` directly
