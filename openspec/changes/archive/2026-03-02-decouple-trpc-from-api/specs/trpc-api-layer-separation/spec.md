## ADDED Requirements

### Requirement: TRPC package owns router and contract source of truth

The `@norish/trpc` package SHALL own `AppRouter`, procedure definitions, and client-facing tRPC contract exports.

#### Scenario: Router source of truth remains in TRPC

- **WHEN** TRPC router definitions are inspected
- **THEN** `appRouter` composition SHALL be defined in `@norish/trpc`
- **AND** client typing for TRPC SHALL derive from TRPC package exports

### Requirement: API package hosts and mounts TRPC endpoint

The `@norish/api` package SHALL host the `/trpc` endpoint and mount router runtime from `@norish/trpc`.

#### Scenario: API route mounts TRPC router

- **WHEN** API endpoint routing is inspected
- **THEN** API route adapters SHALL import router runtime from `@norish/trpc`
- **AND** endpoint handling SHALL execute through API-hosted route entrypoints

#### Scenario: TRPC source remains API-independent

- **WHEN** code under `packages/trpc/src/**` is inspected
- **THEN** imports SHALL resolve only to allowed shared/runtime-safe packages and local TRPC modules
- **AND** no module under `packages/trpc/src/**` SHALL import from `@norish/api/*`

### Requirement: Package dependency direction remains acyclic

Workspace dependency direction SHALL remain one-way for TRPC/API boundaries so circular package dependencies cannot be introduced by tRPC integration changes.

#### Scenario: Boundary dependency direction is validated

- **WHEN** workspace dependency validation runs
- **THEN** `@norish/api` MAY depend on `@norish/trpc`
- **AND** `@norish/trpc` SHALL NOT depend on `@norish/api`
