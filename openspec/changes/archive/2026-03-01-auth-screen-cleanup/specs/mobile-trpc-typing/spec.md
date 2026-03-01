## ADDED Requirements

### Requirement: Mobile tRPC client is fully typed via AppRouter

The mobile app's tRPC provider SHALL be instantiated with the `AppRouter` type from `@norish/api/trpc`, so that `useTRPC()` returns a fully typed router proxy. No `any` casts SHALL be required at call sites.

#### Scenario: useTRPC returns typed client

- **WHEN** a component or hook calls `useTRPC()`
- **THEN** the returned object SHALL expose all router procedures with their correct input and output types derived from `AppRouter`
- **AND** calling a procedure (e.g. `trpc.config.authProviders.queryOptions(...)`) SHALL not require casting to `any`

#### Scenario: Type errors surface at compile time

- **WHEN** a developer references a procedure that does not exist on `AppRouter`
- **THEN** TypeScript SHALL report a compile-time error
- **AND** `tsc --noEmit` SHALL fail with a descriptive type error

#### Scenario: No runtime overhead from the type parameter

- **WHEN** the mobile bundle is built
- **THEN** the `AppRouter` type import SHALL be erased (type-only import)
- **AND** no server-side code from `@norish/api` SHALL be included in the mobile bundle
