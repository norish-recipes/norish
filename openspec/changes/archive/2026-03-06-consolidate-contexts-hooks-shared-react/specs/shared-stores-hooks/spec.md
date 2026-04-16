## ADDED Requirements

### Requirement: Shared React exposes reusable stores hook family

`@norish/shared-react` SHALL expose a `createStoresHooks` factory that returns stores query, mutation, cache, and subscription hooks using tRPC binding injection.

#### Scenario: Shared stores hooks are available to both apps

- **WHEN** web and mobile import shared stores hooks
- **THEN** both apps SHALL resolve the same shared-react hook factories
- **AND** shared stores modules SHALL NOT import platform runtime modules

### Requirement: Stores hook family includes query, mutation, cache, and subscription hooks

The `createStoresHooks` factory SHALL return hooks covering the store management lifecycle.

#### Scenario: Complete stores hook family is returned

- **WHEN** an app calls `createStoresHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useStoresQuery`, `useStoresMutations`, `useStoresCache`, and `useStoresSubscription`
