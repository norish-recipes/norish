## Context

Norish completed major monorepo transition steps, but root hardening still carries migration leftovers: mixed script ownership, root hygiene checks that only gate config-like files, many temporary root dependency exceptions, and stale references to legacy pre-monorepo paths. These gaps make hardening closure brittle because policy intent exists, but enforcement and ownership boundaries are not yet fully aligned.

The previous folder-placement design allowed root-level orchestration scripts while relocating package-specific scripts. This follow-up narrows that policy by defining ownership-aligned script homes and requiring root scripts to remain orchestration/delegation only.

## Goals / Non-Goals

- Goals:
  - Complete root hardening as policy + enforcement, not convention.
  - Separate monorepo control scripts from app/package-owned scripts by filesystem location.
  - Expand root hygiene gating to explicit root file and directory allowlists.
  - Reduce temporary root dependency exceptions by migrating root test ownership to workspaces and removing legacy root test copies.
  - Remove stale legacy path references from hardening-era checks/docs.
- Non-Goals:
  - Introduce product feature behavior changes.
  - Redesign package boundaries beyond ownership cleanup needs.
  - Force full root `__tests__` migration in a single change if phased migration is safer.

## Decisions

- Decision: Adopt ownership-based script placement.
  - `tooling/monorepo/scripts/*` owns repository control-plane checks and orchestration utilities.
  - `apps/*/scripts/*` owns app-specific operational scripts.
  - `packages/*/scripts/*` owns package-specific scripts.
  - Root `package.json` remains a command router/delegator.

- Decision: Upgrade root hygiene from config-only checks to explicit root inventory checks.
  - Policy tracks approved root files and approved root directories.
  - Validation fails on unallowlisted root entries, including non-config clutter.
  - Temporary shims remain allowed only when metadata is complete (owner, rationale, remove-by).

- Decision: Treat temporary root dependency exceptions as measurable burn-down debt.
  - Every exception references active root-owned usage and a concrete removal task.
  - Root `__tests__` migration waves are the primary path to remove runtime-oriented root exceptions.
  - Each migrated root test file is deleted from root in the same wave; empty legacy root test directories are pruned.
  - Hardening evidence reports before/current exception counts and remaining migration scope.

- Decision: Make hardening exit include legacy-reference retirement.
  - Validation scripts/config must target current monorepo paths.
  - Contributor docs must describe current `apps/*`, `packages/*`, and tooling ownership.

## Alternatives Considered

- Alternative A: Move all scripts into a single `tooling/` folder.
  - Rejected: weak ownership boundaries; app/package concerns become centralized policy debt.
- Alternative B: Keep current mixed script placement and only update docs.
  - Rejected: does not solve enforcement gaps or root clutter regressions.
- Alternative C: Require complete root test migration before any policy updates.
  - Rejected: too risky for one pass; phased burn-down with strict evidence is safer.

## Risks / Trade-offs

- Risk: Script moves break existing command paths.
  - Mitigation: keep root command aliases stable while relocating implementations.
- Risk: Stricter allowlists initially fail due to unknown root artifacts.
  - Mitigation: capture current baseline intentionally, then tighten with explicit ownership.
- Trade-off: Additional policy metadata and evidence work.
  - Benefit: migration closure becomes auditable and durable.

## Migration Plan

1. Relocate scripts by ownership and update command references.
2. Add explicit root file/directory allowlists and enforce them in root hygiene checks.
3. Update temporary exception metadata with active file usage + linked removal tasks.
4. Migrate root `__tests__/**` into owning workspaces in waves, deleting migrated root files/directories in each wave, and transfer dependency ownership.
5. Remove stale legacy references from checks/config/docs and re-run hardening validation.

## Open Questions

- None blocking proposal approval.
