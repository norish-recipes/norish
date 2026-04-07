## Purpose

Define a client-safe TRPC typing boundary for mobile and web consumers so contract usage does not require traversing server-only implementation modules.

## Requirements

### Requirement: Extracted standalone tRPC package provides client-safe boundary

The workspace SHALL provide a standalone tRPC package that is consumed by API server and clients, and that exports `AppRouter` plus explicitly approved client-facing types without exposing server-only internals.

#### Scenario: Client apps import router type from extracted boundary

- **WHEN** mobile or web client code imports `type AppRouter` for tRPC client/provider typing
- **THEN** the import SHALL resolve from the extracted standalone tRPC package or entrypoint
- **AND** the import SHALL be type-only with no required runtime symbol usage

#### Scenario: Contract boundary limits public surface

- **WHEN** consumers inspect the contract boundary exports
- **THEN** only approved public tRPC typing contracts SHALL be exposed
- **AND** server-only implementation modules SHALL NOT be exported through that boundary

#### Scenario: Client boundary does not require API package imports

- **WHEN** server-only integrations are required for procedure execution
- **THEN** client typing consumption SHALL remain type-only through TRPC boundary exports
- **AND** clients SHALL NOT require importing `@norish/api/*` to use TRPC contracts

### Requirement: API server and clients share the same extracted router source of truth

The extracted standalone tRPC package SHALL be the source of truth for router composition/types used by API runtime and client typing, so clients do not import API package internals.

#### Scenario: Router typing stays aligned after extraction

- **WHEN** router type signatures change in the extracted package
- **THEN** API runtime and clients SHALL resolve the updated contracts from that package
- **AND** mobile/web typing inference SHALL update without importing API source modules

---

### Requirement: Mobile typecheck is isolated from unrelated server-source errors

`apps/mobile` typecheck SHALL be executable against the extracted standalone tRPC package without traversing unrelated API/auth/queue source compile failures.

#### Scenario: Mobile typecheck runs with server-source issues present

- **WHEN** unrelated type or module errors exist in server/workspace sources outside mobile and contract boundary
- **THEN** `apps/mobile` typecheck SHALL still evaluate mobile and its declared dependencies
- **AND** the run SHALL fail only on errors within the mobile graph and consumed contract artifacts

---

### Requirement: Workspace build succeeds after migration from deprecated tRPC path

After extraction and import migration, workspace build/typecheck validation SHALL pass for migrated consumers without relying on `@norish/api/trpc`.

#### Scenario: Migrated workspaces compile without deprecated path

- **WHEN** CI executes workspace build/typecheck targets after migration
- **THEN** `apps/mobile`, `apps/web`, and migrated dependent packages SHALL compile/typecheck successfully
- **AND** no migrated consumer SHALL require `@norish/api/trpc` imports for tRPC contracts/runtime wiring
