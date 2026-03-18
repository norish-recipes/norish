## 1. Confirmed Progress (Already Done)

- [x] 1.1 Capture and document root hygiene before/after baseline and ownership mapping.
- [x] 1.2 Move root runtime dependencies into owning workspaces so root `dependencies` only contain workspace links.
- [x] 1.3 Remove duplicate root wrappers (`next.config.js`, `postcss.config.js`) and track temporary shims with owner/rationale/removal date.
- [x] 1.4 Harden `.npmrc` install behavior (`shamefully-hoist=false`, `hoist=false`, `strict-peer-dependencies=true`, `auto-install-peers=false`).
- [x] 1.5 Add root hygiene and workspace dependency declaration checks and wire them into `monorepo:check`.

## 2. Remaining Work: Root devDependency Cleanup

- [ ] 2.1 Produce an explicit classification table for every root `devDependency` as either `root-tooling` or `temporary-exception`.
- [ ] 2.2 For each temporary exception, record root file usage references in policy metadata and link a concrete migration/removal task.
- [ ] 2.3 Migrate root-level tests/helpers that import app/backend runtime libraries into owning workspace test locations.
- [ ] 2.4 Move dependency ownership for migrated tests into the owning workspace manifests and remove now-unused root devDependencies.
- [ ] 2.5 Update root allowlists/exceptions so root devDependencies represent only true control-plane tooling plus justified temporary exceptions.

## 3. Remaining Work: Hardening Exit Criteria

- [ ] 3.1 Tighten hardening evidence to report temporary exception counts and before/after reduction.
- [ ] 3.2 Confirm no temporary exception remains without owner, rationale, removal milestone, and file usage reference.
- [ ] 3.3 Ensure unresolved temporary exceptions are paired with tracked follow-up items before marking this change complete.

## 4. Final Validation for Commit Readiness

- [ ] 4.1 Run `pnpm install` and `pnpm run monorepo:check` from a clean workspace state.
- [ ] 4.2 Run `pnpm lint:check`, `pnpm run typecheck`, `pnpm test:run`, `pnpm build`, and `pnpm run deps:cycles`; classify failures as fixed, newly introduced, or pre-existing with evidence.
- [ ] 4.3 Run `openspec validate refactor-monorepo-root-cleanup --strict --no-interactive` and keep proposal/tasks/spec deltas in sync with final status.

## Dependencies and Parallelism Notes

- Section 2 is the critical path before hardening closure in section 3.
- Tasks 2.2 and 2.3 can run in parallel after 2.1 is complete.
- Section 4 depends on sections 2 and 3.
