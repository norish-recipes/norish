## Context

`apps/mobile` home is moving to backend-backed recipes while recipe hooks are extracted from `apps/web/hooks/recipes`. The extraction is still mixed, so dashboard usage and single-recipe usage are not obvious from imports. We already have a proven pattern from shared config hooks (shared core + app-owned tRPC bindings + thin app wrappers). This refinement applies that same pattern to recipes and adds an explicit phased hook migration plan.

## Goals / Non-Goals

**Goals:**

- Align recipe hook extraction with the shared config-hook creation pattern.
- Split shared recipe hooks into explicit `dashboard` and `recipe` families.
- Keep platform-specific composition in app wrappers and keep shared-react platform-agnostic.
- Provide a hook-by-hook phased migration plan for implementation clarity.

**Non-Goals:**

- Redesigning recipe card UI or dashboard layout.
- Changing backend endpoints/contracts for recipes.
- Implementing Today planned-meals backend hooks in this change.

## Decisions

1. Mirror shared config hook architecture for recipes.
   - Decision: build shared recipe hook factories/bindings in `packages/shared-react` that accept app-owned typed `useTRPC` bindings.
   - Rationale: this pattern already works across web and mobile.
   - Alternative considered: direct extraction without factory binding. Rejected due to higher coupling risk.

2. Use two explicit shared families: `dashboard` and `recipe`.
   - Decision: expose two clear shared surfaces instead of one mixed recipes barrel.
   - Rationale: reduces ambiguity and enforces intent at import time.
   - Alternative considered: keep mixed exports. Rejected because usage remains unclear.

3. Keep wrappers app-owned.
   - Decision: web/mobile wrappers own navigation, storage, toast, and media side effects.
   - Rationale: side effects are platform-specific and should not leak into shared query core.
   - Alternative considered: fully shared end-to-end feature hooks. Rejected due to platform coupling.

4. Migrate in phases with web parity first.
   - Decision: move shared core and web wrappers first, then wire mobile dashboard sections.
   - Rationale: web offers the broadest current recipe coverage for parity checks.
   - Alternative considered: mobile-first migration. Rejected due to higher regression risk.

5. Keep Today fixture isolated until follow-up.
   - Decision: Today remains fixture-backed; other dashboard sections move to backend-backed hooks.
   - Rationale: planned-meals query+subscription is separate follow-up scope.
   - Alternative considered: include planned-meals now. Rejected to keep scope deliverable.

## Hook Taxonomy

### Dashboard family

- Scope: home/dashboard section-level list data and cache behavior.
- Surfaces: `Continue Cooking`, `Discover`, `Your Collection`.

### Recipe family

- Scope: single recipe detail, item-level mutations, item-level subscriptions, and related enrichments.
- Surfaces: recipe detail/edit and item-level flows.

### Wrapper layer

- Scope: app-specific composition for web/mobile without changing shared query semantics.

## Hook-by-Phase Plan

### Phase 1: Shared foundation and boundaries

- `use-recipe-id`: move to shared `recipe` family and keep id normalization reusable.
- `use-recipes-query`: move to shared `dashboard` family as primary section list query.
- `use-recipes-cache`: move to shared `dashboard` family for dashboard cache operations.
- `use-recipe-query`: move to shared `recipe` family as primary single-recipe read hook.
- `use-pending-recipes-query`: move to shared `dashboard` family for list-level pending states.

### Phase 2: Query and enrichment hook migration

- `use-auto-tagging-query`: move to shared `recipe` family.
- `use-allergy-detection-query`: move to shared `recipe` family.
- `use-nutrition-query`: move to shared `recipe` family.
- `use-recipe-autocomplete`: move to shared `dashboard` family.
- `use-recipe-ingredients`: move to shared `recipe` family.
- `use-random-recipe`: move to shared `dashboard` family.

### Phase 2b: Subscription type pipeline hardening

- Type `createPolicyAwareSubscription` without `any` return so subscription procedures remain explicit in router declaration output.
- Verify emitted `@norish/trpc` declarations preserve subscription procedure types for recipe events.
- Confirm shared recipe factories can access `subscriptionOptions` from app-owned typed `useTRPC` bindings before Phase 3 migration.

### Phase 3: Subscription and mutation core split

- `use-auto-tagging-subscription`: move core subscription logic to shared `recipe` family; keep UI side effects in app wrappers.
- `use-auto-categorization-subscription`: move core subscription logic to shared `recipe` family; keep UI side effects in app wrappers.
- `use-allergy-detection-subscription`: move core subscription logic to shared `recipe` family; keep UI side effects in app wrappers.
- `use-nutrition-subscription`: move core subscription logic to shared `recipe` family; keep UI side effects in app wrappers.
- `use-nutrition-mutation`: move mutation core to shared `recipe` family; keep notifications/navigation in wrappers.
- `use-recipes-mutations`: split into shared mutation core plus app-owned wrapper side effects.
- `use-recipes-subscription`: split into shared cache/subscription core plus app-owned wrapper callbacks.
- `use-recipe-subscription`: split into shared cache/subscription core plus app-owned wrapper callbacks.

### Phase 4: Adapter-backed wrappers and web parity

- `use-recipe-filters`: keep wrapper app-owned; extract query-independent storage contract for web/mobile adapter implementations.
- `use-recipe-images`: move shared query/mutation shape to `recipe` family; keep media payload adaptation in wrappers.
- `use-recipe-videos`: move shared query/mutation shape to `recipe` family; keep media payload adaptation in wrappers.
- `use-recipe-prefetch`: keep web-only (no shared migration).

### Phase 5: Mobile dashboard cutover and cleanup

- `use-recipes-query` + `use-recipes-cache` (+ other dashboard hooks): wire mobile `Continue Cooking`, `Discover`, `Your Collection` to shared dashboard hooks.
- all non-Today mock paths: remove from mobile runtime.
- Today adapter: keep isolated fixture source until planned-meals follow-up hooks are implemented.

## Risks / Trade-offs

- [Boundary drift reintroduces mixed exports] -> Mitigation: family-specific exports/import paths and code review checks.
- [Factory API complexity] -> Mitigation: mirror the shared config-hook binding ergonomics.
- [Web regressions during wrapper migration] -> Mitigation: validate web parity before mobile cutover.
- [Mobile UX regressions in data states] -> Mitigation: verify loading/empty/error/success flows on backend-connected devices.

## Migration Plan

1. Build shared recipe factory/binding foundation in `packages/shared-react` (config-pattern parity).
2. Create `dashboard` and `recipe` family module boundaries and exports.
3. Harden subscription typing pipeline so router declarations preserve subscription procedure types.
4. Migrate hooks phase-by-phase per hook plan above, with web wrappers first.
5. Wire mobile dashboard sections to shared `dashboard` hooks and remove non-Today mocks.
6. Run cross-app validation and leave Today fixture isolated until follow-up planned-meals change.

## Open Questions

- None for this refinement.
