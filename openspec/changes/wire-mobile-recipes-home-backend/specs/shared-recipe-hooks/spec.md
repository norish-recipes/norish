## ADDED Requirements

### Requirement: Shared recipe hooks are reusable across web and mobile
The system SHALL provide recipe-domain React hooks in `packages/shared-react` that can be consumed by both web and mobile applications without platform-specific dependencies.

#### Scenario: Shared hooks compile in both app targets
- **WHEN** web and mobile import the shared recipe hook module
- **THEN** both builds SHALL resolve the same shared-react exports
- **AND** the shared module SHALL NOT import web-only or mobile-only runtime modules

### Requirement: Shared recipe hooks preserve typed recipe query contracts
Shared recipe hooks SHALL preserve strong typing for recipe query inputs and outputs based on the existing tRPC boundary router contracts.

#### Scenario: Typed query usage from shared hooks
- **WHEN** an app calls shared recipe hooks for listing or retrieving recipes
- **THEN** hook inputs and outputs SHALL be inferred from the typed backend procedure contracts
- **AND** implementations SHALL NOT use `any` casts to bypass recipe query typing

### Requirement: Shared recipe hooks support app-specific transport adapters
Shared recipe hooks SHALL accept app-provided query/caller dependencies so web and mobile can reuse hook logic while retaining their existing provider and transport setup.

#### Scenario: App adapter integration
- **WHEN** web and mobile wire shared recipe hooks into their existing providers
- **THEN** each app SHALL provide its own transport/caller binding without changing shared hook behavior
- **AND** shared hook APIs SHALL remain consistent across both apps
