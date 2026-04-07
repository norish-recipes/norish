## ADDED Requirements

### Requirement: Shared React exposes reusable config query hooks

`@norish/shared-react` SHALL provide a reusable hook surface for config tRPC queries currently implemented in web `hooks/config`, including locale configuration queries.

#### Scenario: Web consumes shared config hooks

- **WHEN** web config hooks request data from `config.*` procedures
- **THEN** they SHALL delegate query execution and default-data normalization to shared-react config hooks
- **AND** existing web hook return contracts SHALL remain compatible for current consumers

#### Scenario: Mobile consumes shared locale config hook

- **WHEN** mobile language-related hooks request locale config data
- **THEN** they SHALL use the shared-react config hook for `config.localeConfig`
- **AND** mobile components SHALL receive normalized `enabledLocales` and `defaultLocale` values

### Requirement: Shared config hooks support app-owned TRPC injection

Shared config hooks SHALL allow each client app to bind its own typed `useTRPC` source without importing app-local provider modules into shared packages.

#### Scenario: Hook factory binding for web

- **WHEN** web initializes config hooks
- **THEN** web SHALL inject its app-owned `useTRPC` binding into shared config hook factories
- **AND** no shared-react module SHALL import from `apps/web/**`

#### Scenario: Hook factory binding for mobile

- **WHEN** mobile initializes config hooks
- **THEN** mobile SHALL inject its app-owned `useTRPC` binding into shared config hook factories
- **AND** no shared-react module SHALL import from `apps/mobile/**`

### Requirement: App-specific composition remains in wrappers

Platform-specific logic layered on top of config queries SHALL remain in app wrappers while query behavior is shared.

#### Scenario: Timers-enabled logic remains app-composed

- **WHEN** timers-enabled state requires combining server config with app-specific user context/preferences
- **THEN** the app wrapper SHALL compose that additional logic outside the shared query core
- **AND** shared-react SHALL only expose reusable query data needed for composition
