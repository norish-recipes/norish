## ADDED Requirements

### Requirement: Root Manifest Is Workspace Control Plane

The repository root manifest SHALL function as a workspace control plane and SHALL remain orchestration-focused rather than owning application/backend runtime dependency surfaces.

#### Scenario: Root manifest excludes workspace runtime libraries

- **WHEN** root `package.json` is reviewed during monorepo hardening
- **THEN** runtime libraries used by web/backend execution (for example framework, API/runtime SDKs, DB drivers, and queue runtimes) SHALL be declared in owning `apps/*` or `packages/*` manifests
- **AND** root `dependencies` SHALL remain limited to approved workspace-link/root-control-plane entries
- **AND** root `devDependencies` SHALL be limited to approved root tooling entries plus explicitly documented temporary exceptions tied to root-owned files.
