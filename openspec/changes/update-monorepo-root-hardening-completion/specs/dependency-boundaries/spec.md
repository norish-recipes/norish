## MODIFIED Requirements

### Requirement: Temporary Root Exceptions Are Traceable and Reducible

Any root dependency exception used during migration hardening SHALL be treated as temporary policy debt, SHALL be traceable to active root-owned usage, and SHALL include concrete removal work needed to eliminate the exception.

#### Scenario: Exception metadata proves active need and planned removal

- **WHEN** root dependency exception policy is validated
- **THEN** each temporary exception SHALL include owner, rationale, and target removal milestone
- **AND** each temporary exception SHALL reference one or more active root-owned files that currently require it
- **AND** exceptions justified by root `__tests__/**` usage SHALL include the mapped owning workspace destination for those tests
- **AND** each temporary exception SHALL link to tracked migration work that removes the cited root-owned usage
- **AND** exceptions tied only to tests/helpers that have been migrated into owning workspaces SHALL be removed from root manifest/policy allowlists in that migration wave
- **AND** exceptions without active root-owned usage SHALL be removed from root manifest/policy allowlists.
