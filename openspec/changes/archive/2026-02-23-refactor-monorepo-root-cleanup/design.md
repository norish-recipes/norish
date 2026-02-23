## Context

The migration from single-package layout to `apps/*` + `packages/*` is largely complete, and major root cleanup steps are already implemented (runtime dependency moves, wrapper pruning, install hardening, and hygiene checks). However, validation still shows a broad root `devDependencies` surface.

Current observed state:

- Root `dependencies` are slimmed to workspace links.
- Root `devDependencies` remain large because root-level test/harness files still import runtime libraries.
- Temporary exceptions exist but are not yet fully tied to file-level usage references and removal tasks.

This proposal defines closure criteria for that remaining gap so root ownership can be considered complete instead of partially transitional.

## Goals / Non-Goals

- Goals:
  - Make root a control plane, not a runtime dependency owner.
  - Keep workspace manifests authoritative for direct imports.
  - Reduce temporary root dependency exceptions by migrating root-owned test/harness code into owning workspaces.
  - Require measurable exception tracking (owner/rationale/remove date/file usage reference).
- Non-Goals:
  - Redesign runtime architecture (single deploy topology remains unchanged).
  - Re-split domain packages beyond what ownership cleanup requires.
  - Introduce product-level behavior changes.

## Decisions

- Decision: Keep root manifest allowlists, but split devDependency intent into two explicit classes.
  - `root-tooling`: stable control-plane dependencies that are legitimately root-owned.
  - `temporary-exception`: transitional entries allowed only when a root-owned file currently imports them.

- Decision: Make workspace manifests authoritative for direct imports.
  - Every direct runtime/build/test import is declared in owning workspace.
  - Root manifest is not used as fallback for workspace dependency gaps.

- Decision: Add file-traceability requirements for temporary exceptions.
  - Every temporary root dependency exception must list owner, rationale, remove-by date, and one or more root file references proving current need.
  - Exception entries without active root-level usage are removed.

- Decision: Root-level tests/harness code is migration scope, not permanent policy debt.
  - Root tests that import app/backend runtime libraries are moved to owning workspace test locations.
  - Dependency ownership follows that migration and root exceptions are burned down.

- Decision: Enforce with automated checks, not convention-only guidance.
  - Keep machine-checkable gates for root manifest scope and workspace dependency declaration compliance.
  - Extend evidence expectations to include exception counts and remaining removal tasks.

## Risks / Trade-offs

- Risk: Moving test ownership can surface hidden coupling between root test setup and workspace internals.
  - Mitigation: migrate in small waves with `monorepo:check` and targeted test runs after each move.
- Risk: Strict exception traceability increases maintenance overhead during migration.
  - Mitigation: keep metadata schema minimal and enforce with automation.
- Trade-off: Additional short-term migration work before declaring hardening complete.
  - Benefit: clearer ownership model, lower root surface area, and fewer long-lived policy exceptions.

## Migration Plan

1. Capture current root devDependency classification and temporary exception inventory.
2. Add file-reference + follow-up-task traceability for every temporary exception.
3. Migrate root-level tests/helpers to owning workspaces and move dependency ownership accordingly.
4. Burn down temporary exceptions and update root allowlists.
5. Re-run full hardening validation and update evidence with before/after exception metrics.

## Open Questions

- None blocking for proposal approval.
