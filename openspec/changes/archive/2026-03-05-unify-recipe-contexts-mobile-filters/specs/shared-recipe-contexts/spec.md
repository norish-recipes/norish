## ADDED Requirements

### Requirement: Shared recipe contexts are provided from shared-react

The system SHALL provide both recipe-related contexts from `shared-react` as stable, documented exports that can be consumed by web and mobile clients.

#### Scenario: Consumers import shared contexts

- **WHEN** a web or mobile feature imports a recipe context
- **THEN** it resolves from the `shared-react` package entrypoint rather than app-local duplicated context modules

### Requirement: Context core logic is platform-safe

The system SHALL isolate non-UI recipe context logic from hard web-only React dependencies so shared behavior can execute consistently in all supported clients.

#### Scenario: Shared logic avoids platform-only dependencies

- **WHEN** shared context core modules are evaluated in mobile and web builds
- **THEN** they do not require browser-only modules and expose equivalent behavior through platform-specific adapters where needed

### Requirement: Legacy paths remain temporarily compatible

The system SHALL provide compatibility re-exports for previous context import paths during migration.

#### Scenario: Existing imports continue to function during migration

- **WHEN** a consumer still imports a legacy context path
- **THEN** the import resolves to the shared implementation without behavioral changes
