# Change: Update Monorepo Root Hardening Completion

## Why

The monorepo transition is structurally complete, but root ownership hardening is still partially transitional. Script ownership is mixed across root and workspace scopes, the root hygiene gate only enforces a config-file allowlist, and temporary root dependency exceptions remain high due to a large root `__tests__` surface.

Recent audit findings also show stale pre-monorepo references in dependency checks, server TypeScript include paths, and contributor documentation. Without a follow-up hardening pass, migration closure criteria remain inconsistent with current repository state.

## What Changes

- Establish an ownership-based script placement policy:
  - monorepo control scripts under `tooling/monorepo/scripts/*`
  - app-specific scripts under `apps/*/scripts/*`
  - package-specific scripts under `packages/*/scripts/*`
- Tighten root hygiene policy/checks from config-only allowlisting to explicit root file + root directory allowlists.
- Strengthen temporary exception governance so each root dependency exception is tied to active root-owned usage and linked removal work.
- Trim root `package.json` dependency surface by transferring test-related dependency ownership to the destination app/package as root tests are migrated.
- Add hardening exit requirements that retire stale legacy root-path references in validation scripts/config and align contributor docs with current monorepo layout.
- Require migration of root `__tests__/**` folders/files into owning `apps/*` and `packages/*` test locations, deleting migrated root test files/directories as each wave completes.

## Impact

- Affected specs:
  - `monorepo-folder-placement`
  - `monorepo-migration-phasing`
  - `dependency-boundaries`
- Affected code (implementation stage):
  - Script locations and invocations: `scripts/**`, `tooling/monorepo/**`, `apps/web/**`, `packages/i18n/**`, `package.json`, `apps/web/package.json`
  - Root hygiene policy/checking: `tooling/monorepo/root-hygiene-policy.json`, `scripts/check-root-hygiene.mjs`
  - Exception and test ownership reduction: root `__tests__/**` relocation/deletion and owning workspace manifests
  - Legacy-reference cleanup: `scripts/check-circular-deps.mjs`, `tsconfig.server.json`, `CONTRIBUTING.md`
- Risk profile:
  - Medium: stricter hygiene enforcement and script relocation can surface latent ownership gaps; mitigated via staged moves and explicit validation gates.
