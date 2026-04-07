## ADDED Requirements

### Requirement: Shared React exposes reusable favorites hook family

`@norish/shared-react` SHALL expose a `createFavoritesHooks` factory that returns favorites query and mutation hooks using tRPC binding injection.

#### Scenario: Shared favorites hooks are available to both apps

- **WHEN** web and mobile import shared favorites hooks
- **THEN** both apps SHALL resolve the same shared-react hook factories
- **AND** shared favorites modules SHALL NOT import platform runtime modules

### Requirement: Shared favorites hooks support app-owned tRPC binding injection

Shared favorites hooks SHALL allow each app to inject its own typed `useTRPC` binding.

#### Scenario: App binds tRPC to shared favorites hooks

- **WHEN** an app calls `createFavoritesHooks({ useTRPC })`
- **THEN** the returned object SHALL include `useFavoritesQuery` and `useFavoritesMutation`
- **AND** query/mutation behavior SHALL remain identical regardless of app binding source
