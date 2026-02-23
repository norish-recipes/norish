# Change: Refactor to a Tailored Turborepo Monorepo

## Why

Norish currently runs as a single-package codebase with frontend, backend, shared types, and tooling tightly coupled. This makes dependency boundaries unclear, contributes to circular imports, and blocks a safe migration to a scalable monorepo layout.

The target is a Turborepo-based monorepo tailored to Norish (not a full t3-turbo clone), with an initial single-deploy topology (`apps/web`) and backend logic extracted into packages. Before moving files, circular dependencies must be identified and resolved to prevent importing across invalid package boundaries.

## What Changes

- Adopt a Turborepo workspace structure inspired by t3-turbo but reduced to only what Norish needs.
- Choose a phase-1 topology where backend logic is a package consumed by `apps/web` (single deploy), not a separate `apps/server` yet.
- Add explicit dependency-boundary requirements to prevent shared code from importing backend internals.
- Catalog and remediate currently detected circular dependencies (baseline: 11 cycles from `madge`).
- Define a migration sequence that preserves current runtime behavior (Next.js app + custom Node server + WebSocket support).
- Add verification gates (cycle checks, build/test/lint/typecheck) for migration safety.

## Research Findings (Current State)

- Current repository is effectively a monolith package (`package.json` at root) with global `@/*` alias.
- Backend is tightly integrated with web runtime (`server.ts`, `server/startup/http-server.ts`, `app/api/trpc/[trpc]/route.ts`, `app/api/auth/[...all]/route.ts`).
- Frontend/server boundary is porous: app/components/hooks/lib import backend modules directly.
- Circular dependency baseline (`pnpm dlx madge --circular ...`):
  - 11 cycles found.
  - Dominant cycle spine: `types/index.ts -> types/dto/user.d.ts -> server/db/index.ts -> server/db/repositories/index.ts -> ...`.
  - Additional self-cycle: `types/index.ts <-> types/dto/planned-item-from-query.d.ts`.
- t3-turbo reference pattern confirms separation into `apps/*` and `packages/*`; however, Expo/mobile-specific pieces are intentionally out of scope for Norish.

## Impact

- Affected specs:
  - `monorepo-architecture` (new)
  - `dependency-boundaries` (new)
- Affected code (planned):
  - Root tooling (`package.json`, `pnpm-workspace.yaml`, `turbo.json`, TypeScript/lint/test configs)
  - Runtime entrypoints (`server.ts`, `server/startup/http-server.ts`, Next API routes)
  - Shared typing/config surfaces (`types/**`, `server/db/zodSchemas/**`, cross-layer imports)
  - CI/deployment (`.github/workflows/*`, `docker/Dockerfile`, compose examples)
- Breaking change risk:
  - Medium during migration; mitigated by phased rollout, dependency constraints, and strict validation gates.
