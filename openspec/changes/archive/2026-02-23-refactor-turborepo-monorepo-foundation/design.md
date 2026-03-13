## Context

Norish currently combines Next.js app code, backend services, DB repositories, auth, queue workers, and shared types inside one package. The codebase already contains a `pnpm-workspace.yaml`, but it does not define workspace package globs. Runtime behavior is a single process: `server.ts` starts startup jobs, initializes workers, boots a custom HTTP server, serves Next.js, and attaches tRPC WebSocket handlers.

Circular dependency analysis reports 11 cycles. Most cycles route through a shared barrel (`types/index.ts`) that re-exports DTOs deriving types from backend schemas (`server/db/...`), while backend repositories also import from that barrel. This bidirectional coupling will break package boundaries if files are split into `apps/*` and `packages/*` without remediation first.

User direction for phase 1 is a single deploy topology. Therefore, backend should be extracted as package(s), while `apps/web` remains the only app initially.

## Goals / Non-Goals

- Goals:
  - Establish a Turborepo monorepo tailored to Norish.
  - Keep phase-1 deployment as a single app (`apps/web`) with backend package(s) consumed by it.
  - Remove known circular imports before or during extraction with explicit gates.
  - Preserve existing behavior (Next routes, tRPC HTTP, tRPC WS, queues, startup jobs).
- Non-Goals:
  - Introduce unused template features from t3-turbo (Expo app, extra web app variants, UI systems not currently used).
  - Split backend into `apps/server` in phase 1.
  - Redesign product behavior or API contracts.

## Decisions

- Decision: Use minimal t3-turbo-inspired layout.
  - Shape: `apps/web` + `packages/*` only.
  - Rationale: matches user request and avoids unnecessary template complexity.

- Decision: Backend is a package in phase 1, not an app.
  - Proposed package role: runtime/backend module(s) imported by `apps/web` for auth, DB, queue, tRPC, and startup orchestration.
  - Rationale: preserves current single deploy model and minimizes immediate infra changes.

- Decision: Introduce strict dependency direction.
  - `packages/shared` (or equivalent) may be imported by both web and backend.
  - Backend packages must not depend on web app modules.
  - Shared packages must not import backend internals.
  - Replace broad barrel imports (`@/types`) with scoped, layer-safe imports.

- Decision: Resolve cycle roots before deep file movement.
  - Root 1: `types/index.ts <-> types/dto/planned-item-from-query.d.ts` self-cycle.
  - Root 2: backend-derived DTOs in `types/dto/*.d.ts` importing `server/db`.
  - Root 3: repositories importing `@/types` barrel that re-imports backend schemas.
  - Remediation pattern:
    - Remove/limit global type barrel exports.
    - Move backend-derived DTO inference to backend package surface.
    - Keep only runtime-safe shared contracts in shared package.

## Alternatives Considered

- Alternative A: Create `apps/server` immediately (web + server apps).
  - Pros: clear app-level separation early.
  - Cons: high migration risk because current web layer directly imports backend internals in many places; requires immediate auth/session + API boundary redesign.
  - Decision: deferred.

- Alternative B: Keep monolith package and only add Turbo task runner.
  - Pros: lowest short-term effort.
  - Cons: does not solve boundary and cycle problems; weak foundation for future scaling.
  - Decision: rejected.

## Migration Plan

1. Baseline and cycle lock-in
   - Record current cycle graph and direct cross-layer imports.
2. Dependency cleanup
   - Remove cycle roots and enforce import direction.
3. Workspace bootstrap
   - Add `apps/*`, `packages/*`, and Turbo task graph; keep behavior unchanged.
4. Extraction
   - Move code into packages with compatibility aliases and incremental import rewrites.
5. Pipeline/deploy alignment
   - Update CI, Docker, and scripts for workspace-aware builds.
6. Hardening
   - Gate on `madge` cycle check + lint/typecheck/tests/build.

## Risks / Trade-offs

- Risk: path alias churn can break runtime imports.
  - Mitigation: phased moves and temporary compatibility exports.
- Risk: auth and startup orchestration are sensitive to initialization order.
  - Mitigation: preserve entrypoint order; add startup smoke checks.
- Risk: over-splitting packages too early increases maintenance overhead.
  - Mitigation: start with coarse packages and split only when needed.

## Open Questions

- None blocking for this proposal stage. Phase-1 topology decision (single deploy) is confirmed.
