## ADDED Requirements

### Requirement: Shared React exposes reusable permissions and server-settings query hooks

`@norish/shared-react` SHALL provide reusable query hooks for permission and server-settings procedures so web and mobile consume a single typed contract for feature gating.

#### Scenario: Web consumes shared permission hooks

- **WHEN** web permission-aware surfaces request permission/server-setting data
- **THEN** they SHALL call shared-react permission/server-settings hooks instead of web-local query implementations
- **AND** existing web consumer contracts SHALL remain backward compatible through web wrappers

#### Scenario: Mobile consumes shared permission hooks

- **WHEN** mobile permission-aware surfaces request permission/server-setting data
- **THEN** they SHALL call the same shared-react permission/server-settings hooks used by web
- **AND** mobile wrappers SHALL receive normalized values required for AI and delete gating

### Requirement: Shared permission hooks preserve app-owned TRPC injection

Shared permission/server-settings hooks SHALL be created through app-injected typed `useTRPC` bindings, with no imports from app-local modules inside shared-react.

#### Scenario: Web injects TRPC binding for permissions hooks

- **WHEN** web initializes shared permission/server-settings hooks
- **THEN** web SHALL inject its own typed `useTRPC` binding
- **AND** shared-react SHALL NOT import from `apps/web/**`

#### Scenario: Mobile injects TRPC binding for permissions hooks

- **WHEN** mobile initializes shared permission/server-settings hooks
- **THEN** mobile SHALL inject its own typed `useTRPC` binding
- **AND** shared-react SHALL NOT import from `apps/mobile/**`
