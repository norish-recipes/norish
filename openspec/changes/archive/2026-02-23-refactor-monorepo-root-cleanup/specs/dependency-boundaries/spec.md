## ADDED Requirements

### Requirement: Workspace Dependency Declarations Are Authoritative

Each `apps/*` and `packages/*` workspace SHALL explicitly declare every direct dependency it imports or executes for runtime, build, test, and lint flows, and SHALL NOT rely on root-level fallback declarations.

#### Scenario: Undeclared direct dependency fails validation

- **WHEN** workspace dependency validation runs
- **THEN** any app/package importing a module not declared in its own manifest SHALL fail validation
- **AND** remediation SHALL add the dependency to the owning workspace manifest instead of root `package.json`.

### Requirement: Temporary Root Exceptions Are Traceable and Reducible

Any root dependency exception used during migration hardening SHALL be treated as temporary policy debt and SHALL include traceability needed for removal.

#### Scenario: Exception metadata proves active need and planned removal

- **WHEN** root dependency exception policy is validated
- **THEN** each temporary exception SHALL include owner, rationale, and target removal milestone
- **AND** each temporary exception SHALL reference one or more root-owned files that currently require it
- **AND** exceptions without active root-owned usage SHALL be removed from root manifest/policy allowlists.
