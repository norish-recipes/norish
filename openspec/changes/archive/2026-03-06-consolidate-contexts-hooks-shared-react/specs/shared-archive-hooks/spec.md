## ADDED Requirements

### Requirement: Shared React exposes reusable archive hook family

`@norish/shared-react` SHALL expose a `createArchiveHooks` factory that returns archive-import query, mutation, cache, and subscription hooks using tRPC binding injection.

#### Scenario: Shared archive hooks are available to both apps

- **WHEN** web and mobile import shared archive hooks
- **THEN** both apps SHALL resolve the same shared-react hook factories
- **AND** shared archive modules SHALL NOT import platform runtime modules

### Requirement: Archive hook family includes import query, mutation, cache, and subscription hooks

The `createArchiveHooks` factory SHALL return hooks covering the archive import lifecycle.

#### Scenario: Complete archive hook family is returned

- **WHEN** an app calls `createArchiveHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useArchiveImportQuery`, `useArchiveImportMutation`, `useArchiveCache`, and `useArchiveImportSubscription`
