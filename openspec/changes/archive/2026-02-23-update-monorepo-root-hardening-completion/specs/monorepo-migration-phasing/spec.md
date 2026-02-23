## MODIFIED Requirements

### Requirement: Root Hygiene Hardening Gate

Final monorepo hardening SHALL include a root hygiene gate that validates root manifest scope, explicit root file/directory placement allowlists, ownership-safe script routing, and install behavior settings against ownership-safe standards.

#### Scenario: Hardening completion requires clean root evidence

- **WHEN** the migration hardening phase is proposed as complete
- **THEN** validation SHALL confirm root `.npmrc` does not enable broad hoisting defaults that mask workspace ownership gaps
- **AND** validation SHALL confirm root manifest and root file/directory layout satisfy approved allowlists
- **AND** validation SHALL fail when root script implementations bypass ownership-aligned locations defined by `monorepo-folder-placement`
- **AND** any temporary exceptions SHALL be recorded with owner, expiry target, and linked follow-up migration work
- **AND** hardening evidence SHALL report temporary exception counts (before/current), root `__tests__` migration progress, and the remaining removal plan for unresolved exceptions.

## ADDED Requirements

### Requirement: Legacy Reference Retirement at Hardening Exit

Hardening completion SHALL retire stale pre-monorepo path references from validation scripts, build/typecheck include settings, and contributor-facing repository layout documentation.

#### Scenario: Legacy root paths are removed or explicitly tracked

- **WHEN** hardening exit evidence is assembled
- **THEN** dependency-cycle and typecheck/build validation inputs SHALL target active monorepo-owned paths only
- **AND** stale references to deprecated root source locations SHALL be removed or documented as temporary exceptions with owner and removal milestone
- **AND** contributor documentation SHALL describe the current `apps/*`, `packages/*`, and tooling ownership model used by the repository.

### Requirement: Root Test Migration Uses Move-and-Prune

Hardening SHALL treat root `__tests__/**` as transitional and SHALL complete test ownership transfer using move-and-prune waves that eliminate migrated legacy root test paths.

#### Scenario: Root test migration wave removes legacy root copies

- **WHEN** root test files are moved to owning workspace test locations
- **THEN** the corresponding root `__tests__/**` files SHALL be deleted in the same migration wave
- **AND** empty legacy root test directories SHALL be removed
- **AND** hardening evidence SHALL report remaining root test file count and linked follow-up work until migration is complete.
