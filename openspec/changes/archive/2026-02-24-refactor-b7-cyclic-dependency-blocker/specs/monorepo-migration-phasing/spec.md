## ADDED Requirements

### Requirement: Tooling Migration Phase B7 Includes Cycle Exit Gate

Phase B7 of tooling migration SHALL require a passing circular dependency gate before Phase C root-cleanup tasks may begin.

#### Scenario: B7 exit requires cycle and quality gates

- **WHEN** Phase B7 validation is executed
- **THEN** validation SHALL include `pnpm run deps:cycles`, `turbo run lint`, `turbo run typecheck`, `turbo run format`, `pnpm test:run`, and `pnpm build`
- **AND** B7 SHALL remain incomplete until all listed commands pass.

#### Scenario: Failed cycle gate blocks next phase

- **WHEN** `pnpm run deps:cycles` reports one or more cycles during B7
- **THEN** Phase C tasks SHALL be treated as blocked
- **AND** the migration plan SHALL add and complete explicit cycle-remediation tasks before Phase C proceeds.
