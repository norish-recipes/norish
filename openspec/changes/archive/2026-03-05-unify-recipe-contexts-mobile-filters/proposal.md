## Why

The recipe filtering flow is currently split across two context implementations, mobile still uses placeholder filters that do not match the web contract, and key mobile surfaces are not wired to real-time/shared data flows. This causes behavior drift, stale UI state, and inconsistent loading feedback across the app.

## What Changes

- Move the two recipe-related contexts into `shared-react` so both web and mobile consume the same contract.
- Replace mobile dummy filter definitions with the real, shared filter model used by the recipe experience.
- Decouple context logic from hard React-specific dependencies where possible so shared code can be consumed safely by mobile.
- Standardize filter state shape and update semantics so clients render and submit consistent filter payloads.
- Wire the mobile dashboard to the shared recipe context so it can receive live recipe updates.
- Wire the mobile search page to actual recipe data instead of placeholder/local-only data.
- Add skeleton loading UX with a new `recipe-card-skeleton.tsx` component under `components/skeletons` for initial load and incremental recipe additions.

## Capabilities

### New Capabilities

- `shared-recipe-contexts`: Provide reusable recipe contexts from `shared-react` with platform-safe dependency boundaries.
- `recipe-filter-contract`: Define a single cross-platform recipe filter contract used by both web and mobile clients.
- `mobile-recipe-live-data`: Ensure mobile dashboard and search screens consume live/shared recipe data flows.
- `recipe-loading-skeletons`: Provide consistent skeleton loading states for recipe list initialization and incremental updates.

### Modified Capabilities

- None.

## Impact

- Affected code: recipe contexts, filter mapping/serialization, mobile recipe dashboard/search data wiring, and shared skeleton UI components.
- APIs/contracts: shared filter state and update contract used across clients.
- Dependencies: `shared-react` package boundaries and any adapters that currently rely on web-only React hooks/utilities.
- Systems: web recipe UI and mobile recipe dashboard/search/filter surfaces now consume the same shared abstractions and loading behavior.
