## ADDED Requirements

### Requirement: Root Hygiene Hardening Gate

Final monorepo hardening SHALL include a root hygiene gate that validates root manifest scope, root file placement, and install behavior settings against ownership-safe standards.

#### Scenario: Hardening completion requires clean root evidence

- **WHEN** the migration hardening phase is proposed as complete
- **THEN** validation SHALL confirm root `.npmrc` does not enable broad hoisting defaults that mask workspace ownership gaps
- **AND** validation SHALL confirm root manifest and root file layout satisfy approved root allowlists
- **AND** any temporary exceptions SHALL be recorded with owner and expiry target
- **AND** hardening evidence SHALL report temporary exception counts (before/current) and the remaining removal plan for unresolved exceptions.
