## 1. Extract query/cache hooks to shared-react

- [ ] 1.1 Move `use-recipe-id`, `use-recipes-query`, `use-recipes-cache`, `use-recipe-query`, and `use-pending-recipes-query` from `apps/web/hooks/recipes` into `packages/shared-react` with unchanged behavior.
- [ ] 1.2 Move `use-auto-tagging-query`, `use-allergy-detection-query`, `use-nutrition-query`, `use-recipe-autocomplete`, `use-recipe-ingredients`, and `use-random-recipe` into `packages/shared-react`.
- [ ] 1.3 Move subscription/mutation hooks that are already platform-agnostic (`use-auto-tagging-subscription`, `use-auto-categorization-subscription`, `use-allergy-detection-subscription`, `use-nutrition-subscription`, `use-nutrition-mutation`) into `packages/shared-react`.
- [ ] 1.4 Export all moved hooks from a shared recipes barrel and ensure type safety stays sourced from existing tRPC boundary contracts.

## 2. Introduce adapter boundaries for web-coupled hooks

- [ ] 2.1 Create storage adapter interface for recipe filters and implement web localStorage + mobile storage variants.
- [ ] 2.2 Split `use-recipes-mutations` into core mutation logic plus UI adapter callbacks (toast, i18n, navigation side-effects).
- [ ] 2.3 Split `use-recipes-subscription` and `use-recipe-subscription` into shared core cache/subscription engines plus app-specific UI/navigation wrappers.
- [ ] 2.4 Create media upload adapter for image/video hooks so web `File/FormData` and mobile asset payloads share one hook contract.

## 3. Migrate web to shared hooks first

- [ ] 3.1 Switch web imports to shared-react for all extracted recipe hooks while preserving behavior.
- [ ] 3.2 Keep `use-recipe-prefetch` web-only and confirm it continues to work with shared query keys.
- [ ] 3.3 Verify web recipe list/detail/dashboard flows and subscription-driven updates still behave identically.

## 4. Wire mobile full recipe dashboard to backend

- [ ] 4.1 Replace mobile home "Your Collection" mock list with shared backend-backed recipe list hooks.
- [ ] 4.2 Wire "Continue Cooking" and "Discover" dashboard sections to shared backend-backed hooks and handle empty/loading/error states.
- [ ] 4.3 Keep Today meal slots on a single isolated fixture adapter for now, and remove all other runtime recipe mocks.
- [ ] 4.4 Integrate shared subscription hooks on mobile so dashboard sections and recipe cards stay in sync with backend events.

## 5. Validation and cleanup

- [ ] 5.1 Remove obsolete mobile mock recipe paths from normal runtime, except the temporary Today fixture adapter.
- [ ] 5.2 Run typecheck/tests for `packages/shared-react`, `apps/web`, and `apps/mobile` to validate cross-platform hook contracts.
- [ ] 5.3 Perform manual mobile verification against a real backend for list, detail sync, dashboard sections, and failure states.

## 6. Follow-up change for Today backend hooks

- [ ] 6.1 Create a follow-up OpenSpec change for shared planned-meals hooks: `use-todays-planned-recipes-query` and `use-todays-planned-recipes-subscription` (names TBD).
- [ ] 6.2 In that follow-up, replace the temporary Today fixture adapter with backend-backed meal-plan data and real-time updates.
