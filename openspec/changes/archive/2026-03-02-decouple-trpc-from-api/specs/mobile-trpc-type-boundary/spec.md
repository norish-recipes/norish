## MODIFIED Requirements

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
