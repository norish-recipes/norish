## Requirements

### Requirement: Web tRPC integration uses extracted standalone package

The web app SHALL consume tRPC runtime/types from the extracted standalone tRPC package rather than `@norish/api/trpc`.

#### Scenario: Web provider typing uses extracted `AppRouter`

- **WHEN** the web tRPC provider and caller utilities are defined
- **THEN** their generic router typing SHALL reference `AppRouter` imported from the extracted standalone tRPC package
- **AND** web tRPC call sites SHALL NOT use `any` casts to bypass router typing

#### Scenario: Web server route wiring uses extracted runtime exports

- **WHEN** web API route wiring imports router/context runtime symbols
- **THEN** those imports SHALL resolve from the extracted standalone tRPC package entrypoints
- **AND** web runtime wiring SHALL NOT depend on `@norish/api/trpc`

---

### Requirement: Web runtime behavior remains unchanged after migration

Changing web import sources to the extracted package SHALL NOT change web tRPC behavior for existing auth and application flows.

#### Scenario: Web auth/app flows continue to call same procedures

- **WHEN** users execute existing web flows that depend on tRPC procedures
- **THEN** the web app SHALL call the same endpoint/procedures as before migration
- **AND** existing success/failure behavior for those flows SHALL be preserved
