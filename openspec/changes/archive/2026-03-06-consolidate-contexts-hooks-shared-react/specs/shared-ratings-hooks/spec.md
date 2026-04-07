## ADDED Requirements

### Requirement: Shared React exposes reusable ratings hook family

`@norish/shared-react` SHALL expose a `createRatingsHooks` factory that returns ratings query, mutation, and subscription hooks using tRPC binding injection.

#### Scenario: Shared ratings hooks are available to both apps

- **WHEN** web and mobile import shared ratings hooks
- **THEN** both apps SHALL resolve the same shared-react hook factories
- **AND** shared ratings modules SHALL NOT import platform runtime modules

### Requirement: Ratings hook family includes query, mutation, and subscription hooks

The `createRatingsHooks` factory SHALL return hooks covering the full ratings lifecycle.

#### Scenario: Complete ratings hook family is returned

- **WHEN** an app calls `createRatingsHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useRatingsQuery`, `useRatingsMutation`, and `useRatingsSubscription`
