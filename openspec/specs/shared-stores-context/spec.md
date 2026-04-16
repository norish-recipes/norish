# shared-stores-context Specification

## Purpose

Defines the shared React shared stores context factory pattern in `@norish/shared-react`, enabling both web and mobile to consume this functionality through a common, app-agnostic factory/adapter pattern.

## Requirements

### Requirement: Shared stores context factory is provided from shared-react

The system SHALL expose a `createStoresContext` factory from `@norish/shared-react/contexts` that creates a stores provider and hook, accepting platform-specific adapters for query, mutations, and subscription.

#### Scenario: Web creates stores context with all adapters

- **WHEN** the web app calls `createStoresContext` with query, mutations, and subscription adapters
- **THEN** the returned `StoresContextProvider` and `useStoresContext` SHALL function identically to the current web implementation
