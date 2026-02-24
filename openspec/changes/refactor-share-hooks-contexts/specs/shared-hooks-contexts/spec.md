## ADDED Requirements

### Requirement: Hook and Context Shareability Classification

The system SHALL classify every hook and context considered for extraction into one of three categories: `runtime-safe`, `adapter-required`, or `web-only`.

#### Scenario: Extraction candidates are classified before migration

- **WHEN** a migration wave for hooks/contexts is planned
- **THEN** each candidate module SHALL be assigned exactly one classification
- **AND** the classification result SHALL be documented before code movement begins

### Requirement: Immediate Extraction of Shareable Modules

Modules classified as `runtime-safe` or `adapter-required` SHALL be extracted from `apps/web` into shared package surfaces as part of this change.

#### Scenario: Runtime-safe modules move without platform adapters

- **WHEN** a module is classified as `runtime-safe`
- **THEN** it SHALL be moved into a shared package path under `packages/*`
- **AND** consuming app imports SHALL be updated to the new shared export path

#### Scenario: Adapter-required modules move with explicit adapters

- **WHEN** a module is classified as `adapter-required`
- **THEN** platform-specific behavior SHALL be represented by an explicit adapter interface
- **AND** web implementation details SHALL be provided from `apps/web`
- **AND** shared module behavior SHALL remain equivalent after extraction

### Requirement: React Native Readiness for Shared Exports

Shared hook/context exports SHALL be consumable by a React Native app without requiring web-only imports.

#### Scenario: Shared exports compile for native consumers

- **WHEN** a React Native workspace imports extracted shared hooks/contexts
- **THEN** the import graph SHALL resolve without `next/*` dependencies
- **AND** required platform adapters SHALL be supplied by the consuming workspace
