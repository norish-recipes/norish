## ADDED Requirements

### Requirement: Root File Allowlist and Wrapper Pruning

Post-migration cleanup SHALL maintain a root-level file allowlist where workspace-specific configuration resides with owning workspaces and legacy root wrappers are pruned or explicitly time-boxed.

#### Scenario: Root wrappers are removed or tracked

- **WHEN** root file placement is reviewed for migration hardening
- **THEN** duplicate/pass-through root wrapper files for workspace-owned configs SHALL be moved, removed, or converted into documented temporary shims
- **AND** each temporary shim SHALL record an owner, rationale, and target removal milestone.
