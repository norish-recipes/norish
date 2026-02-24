## 1. Discovery and classification

- [x] 1.1 Inventory all `apps/web/context/**` and `apps/web/hooks/**` modules and classify each as `runtime-safe`, `adapter-required`, or `web-only`.
- [x] 1.2 Record non-shareable modules with blocking dependency reason (for example Next.js router, browser-only APIs, HeroUI-only composition) and migration trigger.

## 2. Shared package extraction

- [x] 2.1 Create/expand shared React exports for extracted hooks/contexts in a package under `packages/*`.
- [x] 2.2 Move `runtime-safe` modules into shared package paths and update imports in `apps/web`.
- [x] 2.3.0 Define shared adapter contracts as a prerequisite for cross-platform hooks:
  - Data adapter surface for `query`/`mutation`/`subscription`/`cache` patterns.
  - i18n adapter surface for locale access used by shared hooks.
  - Web adapter implementations backed by current tRPC + `next-intl` wiring.
  - Contract constraints to keep shared hooks free of `@/`, `next/*`, and app-local provider imports.
- [ ] 2.3.1 Reclassify currently blocked `runtime-safe` candidates as adapter-required and migrate them by wave:
  - Wave A (web data/context coupling):
    - `apps/web/context/household-context.tsx`
    - `apps/web/context/permissions-context.tsx`
    - `apps/web/context/recipes-filters-context.tsx`
    - `apps/web/hooks/recipes/use-recipe-ingredients.ts`
    - `apps/web/hooks/use-recurrence-detection.ts`
    - `apps/web/hooks/user/use-active-allergies.ts`
  - Wave B (UI/container coupling):
    - `apps/web/hooks/calendar/use-calendar-dnd.ts`
    - `apps/web/hooks/groceries/use-grouped-grocery-dnd.ts`
  - Wave C (barrel surfaces blocked by unresolved local exports):
    - `apps/web/hooks/admin/index.ts`
    - `apps/web/hooks/archive/index.ts`
    - `apps/web/hooks/caldav/index.ts`
    - `apps/web/hooks/calendar/index.ts`
    - `apps/web/hooks/config/index.ts`
    - `apps/web/hooks/favorites/index.ts`
    - `apps/web/hooks/groceries/index.ts`
    - `apps/web/hooks/households/index.ts`
    - `apps/web/hooks/permissions/index.ts`
    - `apps/web/hooks/ratings/index.ts`
    - `apps/web/hooks/recipes/index.ts`
    - `apps/web/hooks/stores/index.ts`
  - Strategy constraints:
    - Move one file at a time (move -> delete old path -> build -> fix build errors).
    - Introduce adapter interfaces first for any `@/hooks`, `@/context`, `@/components`, or router/browser-coupled dependency.
    - Only move barrel files after all referenced modules have shared-safe import paths.
- [ ] 2.3.2 Move `adapter-required` modules by extracting platform-specific effects behind injected adapters/interfaces.
- [ ] 2.4 Keep `web-only` modules in `apps/web` and replace direct cross-module imports with shared interfaces where needed.

## 3. Boundary enforcement

- [ ] 3.1 Add dependency guardrails so shared hooks/contexts cannot import `next/*`, DOM globals, or web-only UI wrappers directly.
- [ ] 3.2 Add lint or dependency-check validation that fails CI when shared runtime boundaries are violated.

## 4. Validation

- [ ] 4.1 Run typecheck, lint, and tests for affected workspaces.
- [ ] 4.2 Verify `apps/web` behavior is unchanged for extracted modules.
- [ ] 4.3 Validate React Native readiness by confirming shared exports compile without web-only imports.

## 5. Documentation

- [ ] 5.1 Publish a maintained shareability matrix (module, classification, reason, owner, next action).
- [ ] 5.2 Document adapter patterns and do/don't rules for adding new shared hooks/contexts.
