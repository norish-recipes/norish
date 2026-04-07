# shared-archive-context Specification

## Purpose

Defines the shared React shared archive context factory pattern in `@norish/shared-react`, enabling both web and mobile to consume this functionality through a common, app-agnostic factory/adapter pattern.

## Requirements

### Requirement: Shared archive-import context factory is provided from shared-react

The system SHALL expose a `createArchiveImportContext` factory from `@norish/shared-react/contexts` that creates an archive-import provider and hook pair, accepting platform-specific adapters for archive query and subscription hooks.

#### Scenario: Web creates archive-import context with query and subscription adapters

- **WHEN** the web app calls `createArchiveImportContext` with `useArchiveImportQuery` and `useArchiveImportSubscription` adapters
- **THEN** the returned `ArchiveImportProvider` and `useArchiveImportContext` SHALL function identically to the current web archive-import context

### Requirement: Archive-import context core logic is platform-safe

The shared archive-import context factory SHALL NOT import platform-specific modules.

#### Scenario: Shared logic avoids platform-only dependencies

- **WHEN** shared-react archive-import context modules are evaluated
- **THEN** they SHALL NOT require browser-only or web-framework-specific modules
