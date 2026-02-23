## 1. Phase 0 - Baseline Alignment

- [x] 1.1 Confirm `refactor-turborepo-monorepo-foundation` prerequisite outputs are present (cycle baseline, import inventory, boundary deltas).
- [x] 1.2 Capture a fresh top-level folder inventory and verify it matches the folder matrix in this change.
- [x] 1.3 Mark a rollback checkpoint before workspace moves (phase-0 tag/branch marker).
- [x] 1.4 Document phase-checkpoint naming/evidence convention (for example `monorepo-phase-<n>-checkpoint`) so every later phase has a reproducible rollback anchor.

## 2. Phase 1 - Workspace Bootstrap (Template-Guided)

- [x] 2.1 Add workspace roots for `apps/*`, `packages/*`, and `tooling/*` in `pnpm-workspace.yaml`.
- [x] 2.2 Add root `turbo.json` task graph aligned to Norish commands (`build`, `dev`, `lint:check`, `typecheck`, `test`, `format`).
- [x] 2.3 Scaffold `apps/web` and package manifests for `api`, `auth`, `db`, `queue`, `config`, `shared`, `i18n`, and `ui`.
- [x] 2.4 Port only structural conventions from `turbo-norish`; replace starter source files with Norish-owned placeholders or TODO stubs.
- [x] 2.5 Ensure root scripts expose non-mutating gates used by this plan (at minimum `lint:check`, `typecheck`, `deps:cycles`).
- [x] 2.6 Run workspace bootstrap validation: `pnpm install`, `pnpm lint:check`, `pnpm run typecheck`, `pnpm run deps:cycles`.
- [x] 2.7 Mark phase-1 rollback checkpoint after bootstrap passes.

## 3. Phase 2 - Shared Boundary Extraction

- [x] 3.1 Move `types/**` shared contracts into `packages/shared`; also move DTO-defining Zod schemas from `server/db/zodSchemas/` (e.g., `UserDtoSchema`, `RecipeDashboardSchema`, `IngredientSelectBaseSchema`, `TagSelectBaseSchema`, CalDAV select/view schemas, and related const arrays like `measurementSystems`, `caldavItemTypes`, `caldavSyncStatuses`) so DTO types remain `z.output<>` derivations - not manually duplicated interfaces; delete migrated legacy files from root `types/**` as ownership transfers.
- [x] 3.2 Publish and apply a types ownership matrix during extraction: cross-runtime contracts -> `packages/shared`, backend-only runtime types (for example BullMQ `Job`-bound types from `types/dto/queue.ts`) -> owning backend package, app-only ambient types (`global.d.ts`) -> `apps/web`.
- [x] 3.3 Split `config/**` into `packages/config` (server/runtime config) and `apps/web/config` (web-only config), then remove migrated root `config/**` files.
- [x] 3.4 Move shared locale catalogs/helpers from `i18n/**` into `packages/i18n` and leave Next.js request/runtime adapter in app scope, then remove migrated root `i18n/**` files.
- [x] 3.5 Split `lib/**` into web-only vs shared-runtime-safe modules and relocate accordingly, then remove migrated root `lib/**` modules that now have package/app owners.
- [x] 3.6 Update imports away from root-wide `@/*` to package-scoped imports where boundaries are finalized.
- [x] 3.7 Run a phase-2 cleanup audit to confirm no duplicate authoritative modules remain in root `types`, `config`, `i18n`, or `lib`; record any intentional deferrals in phase evidence with owner and target phase.
- [x] 3.8 Re-run cycle gate (`pnpm run deps:cycles`) and fail on regressions.
- [x] 3.9 Mark phase-2 rollback checkpoint after shared-boundary extraction passes.

## 4. Phase 3 - Backend Package Extraction

- [x] 4.1 Move `server/db/**` to `packages/db` and preserve migrations/schema/repository behavior, then remove migrated legacy root `server/db/**` files.
- [x] 4.2 Move `server/auth/**` to `packages/auth` and preserve auth provider/session behavior, then remove migrated legacy root `server/auth/**` files.
- [x] 4.3 Move `server/trpc/**` and domain services to `packages/api`, then remove migrated legacy root modules for that scope.
- [x] 4.4 Move `server/queue/**`, `server/redis/**`, and scheduler modules to `packages/queue`, then remove migrated legacy root modules for that scope.
- [x] 4.5 Keep startup composition in `apps/web/server/**` (single-process deploy), wiring package exports, then remove superseded root startup entrypoints once app composition is active.
- [x] 4.6 Run a phase-3 cleanup audit to confirm no duplicate authoritative backend modules remain under root `server/**`; record any intentional deferrals in phase evidence with owner and target phase.
- [x] 4.7 Run backend build-first validation (`pnpm test:run`, `pnpm run typecheck`, `pnpm build`, `pnpm run deps:cycles`) without requiring runtime startup in this phase.
- [x] 4.8 Mark phase-3 rollback checkpoint after backend extraction passes.

## 5. Phase 4 - Web App Relocation

- [x] 5.1 Move `app/**` to `apps/web/app/**`, then remove migrated legacy root `app/**` files.
- [x] 5.2 Move `components/**`, `context/**`, `hooks/**`, and `stores/**` into `apps/web`, then remove migrated legacy root files/directories for that scope.
- [x] 5.3 Move `styles/**` and `public/**` into `apps/web`, keep `apps/web/i18n/request.ts` as adapter to `packages/i18n`, then remove migrated legacy root `styles/**` and `public/**` files.
- [x] 5.4 Rewire API routes and middleware (`app/api/**`, `proxy.ts`) to package exports.
- [x] 5.5 Extract reusable UI primitives from `components/shared/**` into `packages/ui`, then remove duplicate web-local primitive copies that become package-owned.
- [x] 5.6 Run a phase-4 cleanup audit to confirm no duplicate authoritative web modules remain in root `app`, `components`, `context`, `hooks`, `stores`, `styles`, or `public`; record any intentional deferrals in phase evidence with owner and target phase.
- [x] 5.7 Run web build-first validation (`pnpm test:run`, `pnpm run typecheck`, `pnpm build`, `pnpm run deps:cycles`); defer runtime startup smoke to phase 6.
- [x] 5.8 Mark phase-4 rollback checkpoint after web relocation passes.

## 6. Phase 5 - CI, Docker, and Runtime Ops Cutover

- [x] 6.1 Update root scripts and docs to workspace-aware commands.
- [x] 6.2 Update `.github/workflows/**` to Turbo/workspace execution model.
- [x] 6.3 Update `docker/Dockerfile` and compose files for `apps/web` build/runtime paths.
- [x] 6.4 Convert `uploads` handling to explicit runtime-volume semantics (not source migration scope).
- [x] 6.5 Remove committed `yt-dlp` binary from source migration path and enforce runtime/bootstrap provisioning.
- [x] 6.6 Run deployment build validation: workspace build plus Docker image build for `apps/web`; defer container boot and runtime health checks to phase 6.
- [x] 6.7 Mark phase-5 rollback checkpoint after ops cutover passes.

## 7. Phase 6 - Hardening and Cleanup

- [x] 7.1 Remove temporary compatibility aliases/shims introduced during moves.
- [x] 7.2 Ensure no placeholder `turbo-norish` starter code remains in production paths.
- [x] 7.3 Run full quality gate: `pnpm lint:check`, `pnpm run typecheck`, `pnpm test:run`, `pnpm build`, `pnpm run deps:cycles`.
- [x] 7.4 Run final runtime smoke gate: app startup, auth flow, tRPC HTTP/WS, queue startup job flow, `/api/health`, static uploads serving, and container boot. (Skipped by user request for manual validation.)
- [x] 7.5 Record final folder placement and phase completion evidence in migration docs.
- [x] 7.6 Mark final migration checkpoint (phase-6 complete) and archive rollback evidence links.

## Dependencies and Parallelism Notes

- Phase 0 is a hard prerequisite for phases 1-6.
- Phase 2 must complete before phase 3 for boundary-safe extraction.
- In phase 3, tasks 4.1 and 4.2 can run in parallel; 4.3 depends on both.
- In phase 4, tasks 5.2 and 5.3 can run in parallel after 5.1.
- In phase 5, tasks 6.2 and 6.3 can run in parallel after phase 4 stabilizes.
