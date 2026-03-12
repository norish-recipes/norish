## MODIFIED Requirements

### Requirement: Enforced Dependency Direction Between Layers

The workspace SHALL enforce one-way dependency direction so shared contracts never import backend internals and backend code never depends on app-specific modules. For the TRPC/API boundary, `@norish/api` MAY depend on `@norish/trpc`, and `@norish/trpc` SHALL NOT depend on `@norish/api`.

#### Scenario: Import direction remains valid after extraction

- **WHEN** modules are moved to `apps/*` and `packages/*`
- **THEN** shared package(s) SHALL only depend on other shared/runtime-safe modules
- **AND** backend package(s) MAY depend on shared package(s)
- **AND** backend package(s) SHALL NOT import from `apps/web`

#### Scenario: TRPC to API dependency back-edge is prevented

- **WHEN** package dependency validation runs for the workspace
- **THEN** `@norish/api` MAY import from `@norish/trpc`
- **AND** `@norish/trpc` SHALL NOT import from `@norish/api`
- **AND** boundary compliance SHALL preserve the model where API hosts routes and TRPC owns router/contracts
