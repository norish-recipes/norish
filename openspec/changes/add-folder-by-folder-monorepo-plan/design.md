## Context

Norish is currently a single-package repository with major source directories at the root (`app`, `components`, `hooks`, `server`, `types`, etc.). A working `turbo-norish` reference exists and demonstrates a Turborepo shape (`apps/*`, `packages/*`, `tooling/*`), but its source code is mostly starter/template code and does not represent Norish runtime behavior.

There is already an active baseline change (`refactor-turborepo-monorepo-foundation`) that establishes dependency-boundary expectations and circular-dependency cleanup work. This proposal extends that baseline by adding an execution-grade migration blueprint: every top-level folder gets an explicit destination and each move is assigned to a migration phase.

## Goals / Non-Goals

- Goals:
  - Provide a complete folder-by-folder placement map for the Norish repository root.
  - Define an ordered migration plan with entry/exit gates per phase.
  - Use `turbo-norish` as structural guidance while replacing placeholder source implementation.
  - Preserve current single-deploy runtime behavior during phase 1 (`apps/web` + backend packages).
- Non-Goals:
  - Implement migration in this proposal change.
  - Introduce template apps/patterns not needed by Norish (Expo, TanStack Start variants, etc.).
  - Force early over-splitting of backend into too many packages before behavior parity is proven.

## Decisions

- Decision: Use `turbo-norish` for workspace scaffolding patterns, not as a direct code transplant.
  - Keep: workspace/task graph patterns (`apps/*`, `packages/*`, `tooling/*`, Turbo task model).
  - Replace: starter app/router/auth/db/sample UI code with Norish production modules.

- Decision: Adopt a phase-1 target topology centered on `apps/web`.
  - Proposed workspace shape:

```text
apps/
  web/
packages/
  api/
  auth/
  db/
  i18n/
  queue/
  config/
  shared/          # DTO Zod schemas + inferred types + pure contracts (zod is only runtime dep)
  ui/
tooling/
  eslint/
  prettier/
  tailwind/
  typescript/
  vitest/
  github/
```

  - `packages/shared` owns DTO-defining Zod schemas (e.g., `UserDtoSchema`, `RecipeDashboardSchema`, `IngredientSelectBaseSchema`, `TagSelectBaseSchema`, CalDAV schemas) and their inferred TypeScript types. This is the single source of truth for cross-layer contracts. Backend and web both import from `packages/shared`; neither owns the DTO shape definitions. `packages/shared` depends only on `zod` — no Drizzle, no backend internals.
  - `packages/db` retains Drizzle table schemas, insert/update validation, and DB-specific Zod transforms that reference Drizzle internals.
  - `packages/api` remains broad in phase 1 (tRPC + domain services) to avoid premature micro-packaging.

- Decision: Keep migration mechanical first; defer cosmetic structure shifts.
  - Move current Next.js folder style into `apps/web` as-is first.
  - Optional `src/` re-rooting can happen later, after runtime parity is stable.

## Root Folder Placement Matrix

| Norish root folder | Target location in monorepo | Disposition | Action | Primary phase |
| --- | --- | --- | --- | --- |
| `.github` | `.github/` and `tooling/github/` (composite setup) | `split` | Keep root workflows; refactor shared setup into tooling action | 5 |
| `.vscode` | `.vscode/` | `keep-root` | Keep at root | 6 |
| `__tests__` | `apps/web/__tests__/` and `packages/*/tests/` | `split` | Split by ownership; keep shared setup in `tooling/vitest` | 4-6 |
| `app` | `apps/web/app/` | `migrate` | Move as web app routes | 4 |
| `components` | `apps/web/components/` + `packages/ui/src/` | `split` | Move all to web first, then extract reusable primitives to `packages/ui` | 4-6 |
| `config` | `packages/config/src/` + `apps/web/config/` | `split` | Split server/runtime config vs web-only display config | 2-3 |
| `context` | `apps/web/context/` | `migrate` | Move as client/web state context | 4 |
| `dist-server` | Generated artifact under app build outputs | `generated` | Do not migrate as source; regenerate from build | 6 |
| `docker` | `docker/` (root) | `keep-root` | Keep root infra folder; update paths for workspace layout | 5 |
| `hooks` | `apps/web/hooks/` + optional `packages/shared/src/` extracts | `split` | Move web hooks; promote cross-runtime helpers to `packages/shared` only when runtime-safe | 4-6 |
| `i18n` | `packages/i18n/src/` + `apps/web/i18n/request.ts` | `split` | Split locale catalogs/helpers into package; keep Next.js request adapter in app | 2-4 |
| `lib` | `apps/web/lib/` + `packages/shared/src/` + backend packages | `split` | Split by runtime boundary (web-only, shared, backend-only) | 2-4 |
| `node_modules` | Workspace-managed install outputs | `generated` | Generated only; no migration action | N/A |
| `openspec` | `openspec/` (root) | `keep-root` | Keep root governance docs | 0 |
| `public` | `apps/web/public/` | `migrate` | Move static assets into web app | 4 |
| `scripts` | `scripts/` (root) + package-local scripts | `split` | Keep repo scripts for orchestration; relocate package-specific scripts | 5-6 |
| `server` | `packages/api|auth|db|queue/` + `apps/web/server/` composition layer | `split` | Split backend by concern, keep startup composition in app | 3 |
| `stores` | `apps/web/stores/` | `migrate` | Move client state stores | 4 |
| `styles` | `apps/web/styles/` + `tooling/tailwind/` | `split` | Keep app styles local; centralize theme/build primitives in tooling | 4-5 |
| `tooling` | `tooling/*` workspaces | `migrate` | Convert current tooling modules to explicit workspace packages | 1 |
| `types` | `packages/shared/src/contracts/` + package-local internal types | `split` | Split shared contracts from backend-derived internals; DTO-defining Zod schemas from `server/db/zodSchemas/` move here as the single source of truth (DTO types remain `z.output<>` derivations, not manual duplicates) | 2 |
| `uploads` | Runtime volume path (outside git-tracked source) | `runtime-data` | Treat as runtime data only; preserve mount semantics | 5 |
| `yt-dlp` | Runtime binary under `/app/bin` (Docker/bootstrap managed) | `remove` | Remove committed binary from source migration scope; provision at runtime/bootstrap instead | 5 |
| `.next` | `apps/web/.next/` generated | `generated` | Generated only; no migration action | N/A |

### Shared Types Ownership Rules

- `packages/shared/src/contracts/**` is only for cross-runtime contracts: DTO-defining Zod schemas, inferred DTO types, and shared constants/enums used by both web and backend.
- Backend-only runtime types stay with owning backend packages; for example, BullMQ `Job`-bound queue contracts currently in `types/dto/queue.ts` move to `packages/queue` (not `packages/shared`).
- App-only ambient declarations stay app-local (for example `global.d.ts` under `apps/web`).
- `packages/shared` MUST NOT import Drizzle schema modules, backend loggers, or backend runtime services.

## Server Decomposition Plan (`server/**`)

| Current server area | Target package | Notes |
| --- | --- | --- |
| `server/trpc/**` | `packages/api/src/trpc/**` | tRPC routers/context/ws adapters move here |
| `server/auth/**` | `packages/auth/src/**` | Better Auth config/providers/claims |
| `server/db/**` | `packages/db/src/**` | Drizzle schema/repositories/migrations; internal-only Zod schemas remain here. DTO-defining Zod schemas (those consumed by `types/dto/*.d.ts`) move to `packages/shared` |
| `server/queue/**`, `server/redis/**`, `server/scheduler/**` | `packages/queue/src/**` | BullMQ workers, queues, redis pub/sub |
| `server/ai/**`, `server/importers/**`, `server/parser/**`, `server/video/**` | `packages/api/src/domains/import/**` (phase 1) | Keep domain services near API first; split later if needed |
| `server/startup/**` + `server.ts` | `apps/web/server/**` | Keep startup orchestration near single deploy entrypoint |
| `server/logger.ts`, shared backend helpers | Owning backend package (`packages/api/src/**`, `packages/auth/src/**`, `packages/queue/src/**`, etc.) | Logger stays backend-only; do not place backend logging in `packages/shared` |

## Phased Migration Plan

1. Phase 0 - Baseline lock and planning alignment
   - Confirm dependency-cycle baseline and active foundation prerequisites.
   - Freeze target topology and folder mapping.

2. Phase 1 - Workspace bootstrap (template-guided)
   - Introduce `apps/*`, `packages/*`, `tooling/*`, Turbo tasks, and workspace manifests.
   - Import only scaffolding patterns from `turbo-norish`; remove/replace starter implementation code.

3. Phase 2 - Shared boundary extraction
   - Move `types`, shared `lib`, and server config definitions into `packages/shared` and `packages/config`.
   - Move shared locale catalogs and locale metadata from `i18n/messages` into `packages/i18n`.
   - Replace broad root alias usage with package imports where boundaries are clear.

4. Phase 3 - Backend extraction
   - Move `server/**` into `packages/api`, `packages/auth`, `packages/db`, `packages/queue`.
   - Keep startup/server composition in app layer for single-process runtime parity.

5. Phase 4 - Web app relocation
   - Move `app`, `components`, `hooks`, `context`, `stores`, `styles`, and `public` into `apps/web`.
   - Keep `apps/web/i18n/request.ts` as the app-level next-intl runtime adapter consuming `packages/i18n`.
   - Rewire API routes and runtime imports to package exports.

6. Phase 5 - CI, Docker, runtime operations cutover
   - Update workflows, Dockerfile, compose files, and root scripts for workspace-aware paths.
   - Ensure uploads and yt-dlp handling remain runtime-safe and reproducible.

7. Phase 6 - Hardening and cleanup
   - Remove compatibility shims and remaining placeholders.
   - Finalize docs, validate parity, and enforce all quality gates.

## Validation and Exit Gates

- Per-phase minimum validation:
  - `pnpm install`
  - `pnpm lint:check`
  - `pnpm run typecheck`
  - `pnpm test:run`
  - `pnpm build`
  - `pnpm run deps:cycles`
- Runtime smoke checks before phase handoff:
  - Auth login/signup flow
  - tRPC HTTP route behavior
  - tRPC WebSocket startup and subscriptions
  - Queue worker startup and one import job flow
  - Health endpoint and static uploads serving
  - Docker image build and container startup

## Alternatives Considered

- Alternative A: Big-bang move directly into full package split.
  - Rejected: highest regression risk and difficult rollback.
- Alternative B: Keep single package and only add Turbo task runner.
  - Rejected: does not solve boundary and ownership problems.
- Alternative C: Copy `turbo-norish` starter code verbatim.
  - Rejected: placeholder logic diverges from Norish runtime behavior.

## Risks / Trade-offs

- Risk: Import path churn introduces runtime regressions.
  - Mitigation: phase gates, compatibility exports, and smoke tests.
- Risk: Startup orchestration breaks due to package extraction order.
  - Mitigation: keep startup composition in `apps/web/server` through phase 1.
- Risk: Over-splitting backend increases maintenance overhead.
  - Mitigation: broad `packages/api` in phase 1; split only after stability.

## Rollback Strategy

- Create a rollback checkpoint at each phase boundary (tag/branch marker).
- Restrict each phase to reversible moves with compatibility shims.
- If exit gate fails, revert to prior checkpoint and re-run phase with reduced scope.

## Open Questions

- None blocking for proposal approval.
