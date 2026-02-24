## Context

The monorepo migration established `apps/web` and shared backend/packages, but hook/context ownership still largely follows pre-monorepo placement. Existing web modules include a mix of pure state/query composition and web-coupled behavior (Next.js navigation, browser APIs, and web-only UI integration). A React Native client is planned, so we need an immediate extraction path for shareable logic and an explicit contract for what cannot be shared yet.

## Goals / Non-Goals

- Goals:
  - Move eligible hooks/contexts into shared package surfaces now.
  - Define hard runtime boundaries so shared modules stay platform-agnostic.
  - Maintain a living list of web-only modules and migration triggers.
- Non-Goals:
  - Full React Native app implementation.
  - Rewriting product behavior for existing web features.
  - Forcing all hooks/contexts into shared regardless of coupling.

## Decisions

- Decision: Use a three-tier classification (`runtime-safe`, `adapter-required`, `web-only`) as the migration driver.
  - Why: It supports immediate extraction without blocking on all web-coupled modules.
- Decision: Shared hooks/contexts must not import web framework/runtime modules directly.
  - Why: Preserves React Native portability and aligns with dependency-boundary constraints.
- Decision: For adapter-required modules, isolate side effects behind explicit interfaces supplied by each platform.
  - Why: Keeps business state/query logic shared while allowing web/native behavior differences.
- Alternatives considered:
  - Leave hooks/contexts in `apps/web` until React Native starts: rejected because it delays boundary hardening and compounds migration debt.
  - Move everything to shared immediately: rejected because web-only dependencies would leak into shared packages and break portability.

## Risks / Trade-offs

- Risk: Over-classifying modules as web-only slows extraction.
  - Mitigation: Require a migration trigger and owner for each web-only item.
- Risk: Adapter interfaces become too generic and hard to use.
  - Mitigation: Keep adapter APIs narrow and module-specific.
- Trade-off: Additional abstraction overhead in adapter-required modules.
  - Benefit: Predictable cross-platform boundaries and safer future native adoption.

## Migration Plan

1. Audit and classify all hook/context modules.
2. Extract runtime-safe modules first with no behavior changes.
3. Refactor adapter-required modules to isolate platform effects, then extract.
4. Freeze web-only modules in place with explicit reasons and future criteria.
5. Add CI dependency checks to prevent regressions.

## Open Questions

- Which shared package should own extracted React modules long-term (`@norish/shared` vs dedicated `@norish/shared-react`)?
