## Compatibility Export Removal Timing

- Legacy web import path `apps/web/context/recipes-filters-context.tsx` now forwards to the shared context provider from `@norish/shared-react/contexts`.
- Keep the compatibility path for one release cycle to avoid breaking downstream imports that still resolve `@/context/recipes-filters-context`.
- After one stable release, migrate any remaining direct imports to shared entrypoints and remove the compatibility shim.

## Cleanup Completed

- Mobile dummy filter model (`apps/mobile/src/lib/recipes/search-filters.ts`) was removed.
- Mobile dashboard/search now consume shared filter contract helpers and recipe query wiring.
