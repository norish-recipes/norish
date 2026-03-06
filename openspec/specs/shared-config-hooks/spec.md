# shared-config-hooks Specification

## Purpose

Defines the shared React hook surface in `@norish/shared-react` for config tRPC queries, enabling both web and mobile to consume locale and other config data through a common, app-agnostic hook factory pattern.

## Requirements

### Requirement: Shared React exposes reusable config hook family

`@norish/shared-react` SHALL provide a `createConfigHooks` factory that returns all config-related query hooks using tRPC binding injection, including locale configuration queries and the version query hook.

#### Scenario: Complete config hook family is returned

- **WHEN** an app calls `createConfigHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useLocaleConfigQuery`, `useRecurrenceConfigQuery`, `useTagsQuery`, `useTimerKeywordsQuery`, `useTimersEnabledQuery`, `useUnitsQuery`, `useUploadLimitsQuery`, and `useVersionQuery`
- **AND** all hooks SHALL use the injected tRPC binding

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
