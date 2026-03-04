## Why

`wire-mobile-recipes-home-backend` intentionally kept the Today section fixture-backed until shared planned-meals hooks were available. To remove that temporary runtime fixture path, we need shared planned-meals query/subscription hooks that can be consumed by web and mobile wrappers.

## What Changes

- Add shared planned-meals hooks in `packages/shared-react` with app-owned `useTRPC` injection, following the same pattern used for recipe/config hooks.
- Split planned-meals hooks into a query/cache core and subscription core, with platform-specific side effects remaining in app wrappers.
- Wire mobile Today section to the new shared hooks and remove the temporary fixture adapter path.

## Impact

- Today section moves from fixture-backed to backend-backed runtime data.
- Web/mobile wrappers stay app-owned for navigation/toast/storage behavior.
- Shared query keys and cache update behavior become consistent across apps.
