## 1. Phase 1 - Shared Foundation and Boundaries

- [x] 1.1 Create recipe shared hook factory/binding utilities in `packages/shared-react` using the same app-owned `useTRPC` injection pattern as shared config hooks.
- [x] 1.2 Create explicit shared module boundaries and barrels for `dashboard` and `recipe` families.
- [x] 1.3 Move `use-recipe-id` into the shared `recipe` family and keep its id normalization behavior unchanged.
- [x] 1.4 Move `use-recipes-query` into the shared `dashboard` family as the base dashboard list query.
- [x] 1.5 Move `use-recipes-cache` into the shared `dashboard` family for cache key and update behavior.
- [x] 1.6 Move `use-recipe-query` into the shared `recipe` family as the base single-recipe query.
- [x] 1.7 Move `use-pending-recipes-query` into the shared `dashboard` family for list-level pending data handling.

## 2. Phase 2 - Query and Enrichment Hook Migration

- [x] 2.1 Move `use-auto-tagging-query` into shared `recipe` and preserve typed contract behavior.
- [x] 2.2 Move `use-allergy-detection-query` into shared `recipe` and preserve typed contract behavior.
- [x] 2.3 Move `use-nutrition-query` into shared `recipe` and preserve typed contract behavior.
- [x] 2.4 Move `use-recipe-autocomplete` into shared `dashboard` for list/search surfaces.
- [x] 2.5 Move `use-recipe-ingredients` into shared `recipe` for single-recipe enrichment data.
- [x] 2.6 Move `use-random-recipe` into shared `dashboard` for recommendation/discovery surfaces.

## 2b. Phase 2b - Type Pipeline Hardening for Subscriptions

- [x] 2.7 Remove `any` return typing from `createPolicyAwareSubscription` so subscription procedures remain typed in `AppRouter` declarations.
- [x] 2.8 Verify emitted `@norish/trpc` declarations preserve recipe subscription procedure types (no `any` for recipe subscription endpoints).
- [x] 2.9 Validate shared recipe hook factory can consume typed subscription procedures (`subscriptionOptions`) before continuing Phase 3 migration.

## 3. Phase 3 - Subscription and Mutation Core Split

- [x] 3.1 Move `use-auto-tagging-subscription` core cache/subscription logic into shared `recipe`; keep app-side effects in wrappers.
- [x] 3.2 Move `use-auto-categorization-subscription` core cache/subscription logic into shared `recipe`; keep app-side effects in wrappers.
- [x] 3.3 Move `use-allergy-detection-subscription` core cache/subscription logic into shared `recipe`; keep app-side effects in wrappers.
- [x] 3.4 Move `use-nutrition-subscription` core cache/subscription logic into shared `recipe`; keep app-side effects in wrappers.
- [x] 3.5 Move `use-nutrition-mutation` mutation core into shared `recipe`; keep notifications/navigation side effects in wrappers.
- [x] 3.6 Split `use-recipes-mutations` into shared mutation core plus app-owned wrapper callbacks.
- [x] 3.7 Split `use-recipes-subscription` into shared cache/subscription core plus app-owned wrapper callbacks.
- [x] 3.8 Split `use-recipe-subscription` into shared cache/subscription core plus app-owned wrapper callbacks.

## 4. Phase 4 - Adapter Wrappers and App Migration

- [x] 4.1 Keep `use-recipe-filters` app-owned and add storage adapter contracts for web localStorage and mobile storage implementations.
- [x] 4.2 Move `use-recipe-images` shared query/mutation contract into `recipe`; keep media payload adaptation app-owned.
- [x] 4.3 Move `use-recipe-videos` shared query/mutation contract into `recipe`; keep media payload adaptation app-owned.
- [x] 4.4 Keep `use-recipe-prefetch` web-only and validate compatibility with shared query keys.
- [x] 4.5 Refactor `apps/web/hooks/recipes` exports/imports to thin wrappers over shared `dashboard` and `recipe` families.

## 5. Phase 5 - Mobile Dashboard Cutover and Validation

- [x] 5.1 Wire mobile `Continue Cooking`, `Discover`, and `Your Collection` sections to shared `dashboard` hooks.
- [x] 5.2 Verify mobile home loading, empty, error, and success states are driven by shared `dashboard` hooks.
- [x] 5.3 Remove all non-Today runtime recipe mocks from mobile dashboard code paths.
- [x] 5.4 Keep Today meal slots isolated behind one fixture adapter until planned-meals follow-up hooks are delivered.
- [x] 5.5 Run typecheck/tests for `packages/shared-react`, `apps/web`, and `apps/mobile` to verify hook typing and import boundaries.
- [x] 5.6 Manually verify web and mobile flows to confirm `dashboard` hooks are only used for dashboard surfaces and `recipe` hooks are only used for single-recipe surfaces.
- [x] 5.7 Create or link the follow-up OpenSpec change for planned-meals shared hooks (`query + subscription`) to replace the temporary Today fixture (`add-planned-meals-shared-hooks`).
