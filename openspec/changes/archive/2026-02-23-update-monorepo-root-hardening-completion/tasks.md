## 1. Script Ownership Realignment

- [x] 1.1 Inventory root-invoked scripts and classify each as monorepo-control, app-owned, or package-owned.
- [x] 1.2 Move monorepo-control scripts from `scripts/` to `tooling/monorepo/scripts/` and keep root commands as orchestrating entrypoints.
- [x] 1.3 Move web-owned script implementation(s) (including service-worker version update) into `apps/web/scripts/` and update `apps/web/package.json` plus root delegators.
- [x] 1.4 Move i18n-owned script implementation(s) (including locale key checks) into `packages/i18n/scripts/` and update command references.

## 2. Root Hygiene Gate Expansion

- [x] 2.1 Extend `tooling/monorepo/root-hygiene-policy.json` with explicit allowlists for both root files and root directories (config and non-config).
- [x] 2.2 Update root hygiene checker (`tooling/monorepo/scripts/check-root-hygiene.mjs`) to enforce full root inventory allowlists and fail on unallowlisted root entries.
- [x] 2.3 Preserve temporary shim validation and ensure each shim/exception entry has owner, rationale, and removal milestone metadata.

## 3. Temporary Exception Burn-Down via Test Ownership Migration

- [x] 3.1 Produce a root `__tests__` ownership inventory mapped to destination workspaces.
- [x] 3.2 Execute migration waves until root `__tests__/**` folders/files are moved into owning app/package test locations.
- [x] 3.3 Delete migrated root test files in the same wave and remove empty legacy root `__tests__` directories.
- [x] 3.4 Move dependency ownership for migrated test files into workspace manifests and remove now-unused root exceptions/devDependencies.
- [x] 3.5 Update hardening evidence with before/current exception counts, migrated root test counts, and any explicitly deferred remainder.

## 4. Legacy Reference and Documentation Alignment

- [x] 4.1 Remove stale pre-monorepo path targets from dependency-cycle checks and related validation scripts.
- [x] 4.2 Update server typecheck include paths to current monorepo-owned locations only.
- [x] 4.3 Refresh `CONTRIBUTING.md` structure documentation to reflect current monorepo layout and script ownership model.

## 5. Validation

- [x] 5.1 Run `pnpm run hygiene:root`, `pnpm run deps:workspace`, and `pnpm run deps:cycles`.
- [x] 5.2 Run `pnpm lint:check`, `pnpm run typecheck`, `pnpm test:run`, and `pnpm build`.
- [x] 5.3 Run `openspec validate update-monorepo-root-hardening-completion --strict --no-interactive`.

## Dependencies and Parallelism Notes

- Section 1 is prerequisite for script-path validation stability in sections 2 and 5.
- Section 2 should complete before section 3 exception burn-down evidence is finalized.
- Section 4 can run in parallel with section 3 once section 1 script paths are updated.
- Section 5 depends on sections 1-4.
