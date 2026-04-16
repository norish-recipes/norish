# shared-calendar-context Specification

## Purpose

Defines the shared React shared calendar context factory pattern in `@norish/shared-react`, enabling both web and mobile to consume this functionality through a common, app-agnostic factory/adapter pattern.

## Requirements

### Requirement: Shared calendar context factory is provided from shared-react

The system SHALL expose a `createCalendarContext` factory from `@norish/shared-react/contexts` that creates a calendar provider and hook, accepting platform-specific adapters for query, mutations, and subscription.

#### Scenario: Web creates calendar context with all adapters

- **WHEN** the web app calls `createCalendarContext` with query, mutations, and subscription adapters
- **THEN** the returned `CalendarContextProvider` and `useCalendarContext` SHALL function identically to the current web implementation

### Requirement: Calendar context supports desktop and mobile range modes

The factory SHALL accept a `mode` parameter that controls initial date range loading.

#### Scenario: Desktop mode loads current week

- **WHEN** `CalendarContextProvider` is rendered with `mode="desktop"`
- **THEN** the initial date range SHALL cover the current week only

#### Scenario: Mobile mode loads extended range

- **WHEN** `CalendarContextProvider` is rendered with `mode="mobile"`
- **THEN** the initial date range SHALL cover ±2 weeks from today
