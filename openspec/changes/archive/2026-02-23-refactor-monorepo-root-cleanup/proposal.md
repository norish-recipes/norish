# Change: Refactor Monorepo Root Cleanup and Ownership

## Why

The current hardening work removed root runtime dependencies and introduced root hygiene checks, but validation still shows a large root `devDependencies` surface. A subset of these entries are temporary exceptions for root-level test/harness files that still import app/backend runtime libraries (for example `react`, `next`, `@trpc/server`, `ai`, `bullmq`, and `drizzle-orm`).

This makes the change appear "complete" while ownership remains partially transitional. Before final commit and closure, we need explicit completion criteria for what is truly root-owned tooling versus temporary exceptions, plus a concrete path to reduce those exceptions.

## What Changes

- Keep the already-completed root runtime dependency slimming and root wrapper pruning as baseline progress.
- Add explicit completion criteria for root `devDependencies`: classify each entry as either root control-plane tooling or temporary exception.
- Require temporary exceptions to be traceable to root-owned files, with owner/rationale/removal milestone and linked removal tasks.
- Define the remaining migration work to move root-level test/harness files into owning workspaces and remove now-unneeded root devDependencies.
- Tighten hardening validation evidence so the change can only close when exception tracking and burn-down are demonstrably correct.

## Impact

- Affected specs:
  - `monorepo-architecture`
  - `dependency-boundaries`
  - `monorepo-folder-placement`
  - `monorepo-migration-phasing`
- Affected code (implementation stage):
  - Root ownership policy and checks: `tooling/monorepo/root-hygiene-policy.json`, `scripts/check-root-hygiene.mjs`
  - Root manifest and installs: `package.json`, `.npmrc`
  - Root test/harness placement and workspace ownership: `__tests__/**`, `apps/*`, `packages/*`
  - CI/local validation wiring for monorepo hardening gates
- Risk profile:
  - Medium: moving test/harness ownership can expose missing workspace dependencies and test setup coupling; mitigated by phased migration and strict validation after each wave.
