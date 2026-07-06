## ADDED Requirements

### Requirement: Shared groceries context supports mobile adapters

The shared groceries context factory SHALL allow the mobile app to provide native adapters for query, mutations, subscription, storage, and UI state while preserving the split data/UI context contract.

#### Scenario: Mobile creates groceries context with native adapters

- **WHEN** the mobile app creates a groceries context from shared-react using mobile query, mutation, subscription, and storage adapters
- **THEN** the returned provider supplies backend-backed grocery data and actions to mobile descendants
- **AND** mobile components do not need to import web groceries context modules

#### Scenario: Mobile UI state does not force data consumers to rerender

- **WHEN** mobile sheet state, selected editor item, recurrence panel state, or grocery view mode changes
- **THEN** consumers of groceries data remain isolated from UI-only context changes
- **AND** consumers that need UI state use the UI context contract
