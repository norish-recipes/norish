## 1. Baseline and Safety Gates

- [x] 1.1 Capture current circular dependency baseline using `pnpm dlx madge --circular --json --extensions ts,tsx --ts-config tsconfig.json app components config context hooks i18n lib server store stores types` and commit the report artifact for comparison.
- [x] 1.2 Add a repeatable cycle-check command to root scripts and CI so new cycles fail fast.
- [x] 1.3 Inventory direct web-to-backend imports (`app/**`, `components/**`, `hooks/**`, `lib/**`, `i18n/**`, `proxy.ts`) and classify each as runtime vs type-only.

## 2. Resolve Circular Dependencies (Pre-Migration Blocker)

- [x] 2.1 Remove the `types/index.ts <-> types/dto/planned-item-from-query.d.ts` self-cycle by replacing barrel self-import usage with direct module imports.
- [x] 2.2 Remove backend-to-types barrel cycles by replacing backend imports of `@/types` with scoped imports that do not route through server-derived DTO barrels.
- [x] 2.3 Move backend-derived DTO inference (currently tied to `server/db` schemas) behind backend package boundaries, and keep only runtime-safe shared contracts in shared modules.
- [x] 2.4 Re-run cycle check; require zero circular dependencies before workspace extraction proceeds.

## 3. Scaffold Tailored Turborepo Workspace

- [ ] 3.1 Add workspace package globs in `pnpm-workspace.yaml` for `apps/*`, `packages/*`, and existing shared tooling directories actually used by Norish.
- [ ] 3.2 Add `turbo.json` with minimal tasks (`build`, `dev`, `lint`, `typecheck`, `test`, `format`) and dependency graph aligned to Norish workflows.
- [ ] 3.3 Create `apps/web` and initial backend/shared package directories with package manifests and TypeScript configs.

## 4. Extract Code to Packages While Preserving Single Deploy

- [ ] 4.1 Move Next.js app code to `apps/web` and keep custom server startup semantics intact.
- [ ] 4.2 Extract backend modules (auth, db, trpc, queue, startup orchestration) into package(s) consumed by `apps/web`.
- [ ] 4.3 Extract shared runtime-safe contracts/constants into shared package(s); update imports to package names.
- [ ] 4.4 Keep backend as package (not `apps/server`) for phase 1, and document explicit cutover criteria for future split.

## 5. Update Tooling, CI, and Deployment

- [ ] 5.1 Update root scripts to Turbo entrypoints and workspace filters where needed.
- [ ] 5.2 Update lint/test/typecheck configs for workspace paths and package-level execution.
- [ ] 5.3 Update GitHub Actions workflows to run Turbo tasks instead of single-package scripts.
- [ ] 5.4 Update Docker build/runtime paths to reflect `apps/web` + package outputs while preserving current production behavior.

## 6. Validate End-to-End

- [ ] 6.1 Run `pnpm install` and verify workspace linking succeeds.
- [ ] 6.2 Run `pnpm build`, `pnpm lint`, `pnpm test:run`, and `pnpm format:check` across the workspace.
- [ ] 6.3 Run the cycle gate and verify zero cycles.
- [ ] 6.4 Smoke-test dev and production start flows for web, auth, tRPC HTTP, tRPC WS, queues, and startup jobs.

## Dependencies and Parallelism Notes

- Task group 2 blocks groups 3-6.
- Within group 3, items 3.1 and 3.2 can run in parallel.
- Within group 5, items 5.2 and 5.3 can run in parallel after group 4 is stable.
