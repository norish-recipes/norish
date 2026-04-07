## ADDED Requirements

### Requirement: Shared React exposes reusable household hook family

`@norish/shared-react` SHALL expose a `createHouseholdHooks` factory that returns household query, mutation, cache, and subscription hooks using tRPC binding injection.

#### Scenario: Shared household hooks are available to both apps

- **WHEN** web and mobile import shared household hooks
- **THEN** both apps SHALL resolve the same shared-react hook factories
- **AND** shared household modules SHALL NOT import platform runtime modules from `apps/web/**` or `apps/mobile/**`

### Requirement: Shared household hooks support app-owned tRPC binding injection

Shared household hooks SHALL allow each app to inject its own typed `useTRPC` binding using the `create*Hooks({ useTRPC })` factory pattern.

#### Scenario: Web binds app-owned tRPC to shared household hooks

- **WHEN** web initializes shared household hooks
- **THEN** web SHALL inject its app-owned typed `useTRPC` binding
- **AND** shared household query and mutation behavior SHALL remain identical regardless of app binding source

### Requirement: Household hook family includes query, mutation, cache, and subscription hooks

The `createHouseholdHooks` factory SHALL return hooks for querying household data, mutating household settings, managing cache invalidation, and subscribing to real-time updates.

#### Scenario: Complete household hook family is returned

- **WHEN** an app calls `createHouseholdHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useHouseholdQuery`, `useHouseholdMutations`, `useHouseholdCache`, and `useHouseholdSubscription`
