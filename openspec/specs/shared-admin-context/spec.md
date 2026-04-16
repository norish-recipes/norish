# shared-admin-context Specification

## Purpose

Defines the shared React shared admin context factory pattern in `@norish/shared-react`, enabling both web and mobile to consume this functionality through a common, app-agnostic factory/adapter pattern.

## Requirements

### Requirement: Shared admin settings context factory is provided from shared-react

The system SHALL expose a `createAdminSettingsContext` factory from `@norish/shared-react/contexts` that creates an admin settings provider and hook, accepting platform-specific adapters for admin config queries and mutations.

#### Scenario: Web creates admin settings context with all adapters

- **WHEN** the web app calls `createAdminSettingsContext` with query and mutation adapters
- **THEN** the returned `AdminSettingsProvider` and `useAdminSettingsContext` SHALL function identically to the current web implementation
