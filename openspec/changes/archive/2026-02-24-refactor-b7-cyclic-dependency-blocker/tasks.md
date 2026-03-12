## 1. Cycle Remediation Implementation

- [x] 1.1 Replace `@norish/config/server-config-loader` usage of `@norish/db/repositories` barrel import with scoped server-config repository imports.
- [x] 1.2 Remove repository-layer imports of service modules (`@norish/auth/auth`, `@norish/api/downloader`, config loader modules) by relocating or inverting those dependencies at service boundaries.
- [x] 1.3 Keep public module interfaces stable for auth/config/recipe flows while applying cycle-breaking changes.

## 2. Validation Gates

- [x] 2.1 Run `pnpm run deps:cycles` and verify zero cycles.
- [x] 2.2 Run `turbo run lint` and verify all workspaces pass.
- [x] 2.3 Run `turbo run typecheck` and verify all workspaces pass.
- [x] 2.4 Run `turbo run format` and verify formatting checks pass.
- [x] 2.5 Run `pnpm test:run` and verify tests pass.
- [x] 2.6 Run `pnpm build` and verify build succeeds.

## 3. Phase Sequencing Update

- [x] 3.1 Update `finalize-monorepo-tooling-migration` Phase B7 task list to include `pnpm run deps:cycles` as a required B7 exit gate.
- [x] 3.2 Document that Phase C tasks remain blocked until B7 cycle gate and quality gates are green.
