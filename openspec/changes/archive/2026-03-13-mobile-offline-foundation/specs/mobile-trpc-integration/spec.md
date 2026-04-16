## MODIFIED Requirements

### Requirement: Mobile tRPC provider remains strongly typed via boundary contract

The mobile app SHALL type its tRPC client/provider using `AppRouter` from the extracted standalone tRPC package and SHALL NOT use `any` casts to bypass router typing. The `createTRPCProviderBundle` SHALL optionally accept an externally-created `QueryClient` via a `getQueryClient` callback, allowing the mobile side to provide a pre-configured client with persistence.

#### Scenario: Provider typing uses boundary `AppRouter`

- **WHEN** the mobile tRPC provider and caller utilities are defined
- **THEN** their generic router typing SHALL reference `AppRouter` imported from the extracted standalone tRPC package
- **AND** no `any` cast SHALL be used at mobile tRPC call sites to suppress typing errors

#### Scenario: Mobile provides external QueryClient with persistence

- **WHEN** `createTRPCProviderBundle` is called with a `getQueryClient` callback
- **THEN** the bundle SHALL use the externally-provided `QueryClient` instead of creating its own
- **AND** all tRPC queries and mutations SHALL operate through the external client

#### Scenario: Web uses default internal QueryClient

- **WHEN** `createTRPCProviderBundle` is called without a `getQueryClient` callback
- **THEN** the bundle SHALL create its own internal `QueryClient` with default options (existing behavior)
