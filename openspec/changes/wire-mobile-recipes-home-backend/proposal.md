## Why

The mobile home recipe surface currently relies on deterministic mock data, so it does not reflect real backend content or match web behavior. We should wire mobile to the backend using the same recipe-query setup as web to reduce duplicate logic and keep recipe data behavior consistent across clients.

## What Changes

- Replace mobile home recipe mock data usage with backend-backed data retrieval.
- Extract reusable recipe query/client hooks from `apps/web/hooks/recipes` into `packages/shared-react` so both web and mobile consume the same domain logic.
- Add mobile-specific adapter wiring (provider/context/environment pieces) to use shared recipe hooks with the existing mobile tRPC/base URL setup.
- Define mobile home loading, empty, error, and success behavior when data is fetched from the backend.
- Wire dashboard sections (Continue Cooking, Discover, Your Collection) to backend-backed shared hooks so recipes dashboard content runs on live data.
- Keep only the Today meal slots on temporary mock data in this change and queue a follow-up shared hook (`query + subscription`) for planned recipes of today.

## Capabilities

### New Capabilities
- `shared-recipe-hooks`: Shared React recipe data hooks and query helpers consumable by both web and mobile apps.

### Modified Capabilities
- `mobile-home-recipe-cards`: Home recipe list requirements shift from mock-only bootstrap behavior to backend-backed data behavior and states.
- `home-dashboard`: Dashboard sections shift from mock fixtures/subsets to backend-backed data, except Today meal slots which remain temporary mock data pending follow-up meal-plan hook extraction.

## Impact

- Affected code: `apps/mobile` home data wiring, `apps/web/hooks/recipes` extraction points, and `packages/shared-react` new/updated recipe modules.
- Affected APIs: mobile calls existing backend recipe procedures via existing tRPC endpoint derivation; no new backend endpoint required.
- Dependencies/systems: TanStack Query and typed tRPC client usage shared across web/mobile; mobile depends on configured backend URL and authenticated session; Today meal slots remain on a temporary local fixture until follow-up planned-meals hooks land.
