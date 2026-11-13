# 09: Library

**What to build:** The Library under Today: lenses, list and grid, pending imports, filters and empty states. See `.scratch/mobile-redesign/spec.md` Part 2 ("Library") and the Home, HomeGrid boards plus ticket 07's Filters, empty and no-results boards.

**Blocked by:** 08

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: `useLibraryQueryFilters`/`useLibraryList`/`useCookbookList`/`useLibraryCards` (`features/library/hooks/use-library.ts`), pending ids ahead of the items (`library-view.tsx`), `hiddenItemVisibility` (`lib/hidden-items.ts`, `use-hidden-item-visibility.ts`), filter persistence through platform storage (`library-root.tsx`, `lib/recipe-filters-storage.ts`), and the Filters panel's draft (`filters-panel.tsx`).
- [ ] All / Recipes / Cookbooks lenses; list and grid per `recipeViewMode`; cards per the boards (tags with allergens first, time, servings, heart on favourites); paged as web loads.
- [ ] Pending import cards first, not under Cookbooks.
- [ ] Filters sheet on `LibraryFiltersProvider`, web's filters minus "Search in", kept across launches.
- [ ] Empty, no-results (with Clear filters) and skeleton states.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
