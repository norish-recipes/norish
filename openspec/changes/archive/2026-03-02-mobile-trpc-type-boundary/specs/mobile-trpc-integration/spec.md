## ADDED Requirements

### Requirement: Mobile tRPC provider remains strongly typed via boundary contract

The mobile app SHALL type its tRPC client/provider using `AppRouter` from the extracted standalone tRPC package and SHALL NOT use `any` casts to bypass router typing.

#### Scenario: Provider typing uses boundary `AppRouter`

- **WHEN** the mobile tRPC provider and caller utilities are defined
- **THEN** their generic router typing SHALL reference `AppRouter` imported from the extracted standalone tRPC package
- **AND** no `any` cast SHALL be used at mobile tRPC call sites to suppress typing errors

### Requirement: Runtime behavior remains unchanged after type-boundary migration

Changing the import source for `AppRouter` SHALL NOT change runtime behavior of mobile connection/auth flows.

#### Scenario: Connect and auth flows operate after boundary migration

- **WHEN** a user configures backend URL and performs login/register/authenticated API usage
- **THEN** mobile SHALL continue calling the same tRPC HTTP endpoint and procedures as before
- **AND** connect, login, and register flows SHALL preserve existing success and failure behavior
