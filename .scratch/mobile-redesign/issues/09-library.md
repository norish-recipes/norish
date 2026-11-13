# 09: Library

**What to build:** The Library under Today: lenses, list and grid, pending imports, filters and empty states. See `.scratch/mobile-redesign/spec.md` Part 2 ("Library") and the Home, HomeGrid boards plus ticket 07's Filters, empty and no-results boards.

**Blocked by:** 08

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: `useLibraryQueryFilters`/`useLibraryList`/`useCookbookList`/`useLibraryCards` (`features/library/hooks/use-library.ts`), pending ids ahead of the items (`library-view.tsx`), `hiddenItemVisibility` (`lib/hidden-items.ts`, `use-hidden-item-visibility.ts`), filter persistence through platform storage (`library-root.tsx`, `lib/recipe-filters-storage.ts`), and the Filters panel's draft (`filters-panel.tsx`).
- [x] All / Recipes / Cookbooks lenses; list and grid per `recipeViewMode`; cards per the boards (tags with allergens first, time, servings, heart on favourites); paged as web loads.
- [x] Pending import cards first, not under Cookbooks.
- [x] Filters sheet on `LibraryFiltersProvider`, web's filters minus "Search in", kept across launches.
- [x] Empty, no-results (with Clear filters) and skeleton states.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Moved into shared-react: the list hooks, `libraryGridItems`, hidden-item visibility, filter persistence (`useLibraryFiltersPersistence`, storage passed in; the web cookie stays an `onKeep` callback) and the Filters draft (`useFiltersDraft`). Also moved `recipeCardFacts` (tags allergen-first, time, servings) so mobile does not copy web's card logic, and `usePendingRecipesQuery` now returns the imports' links for the pending card's host.
- Library lives in `features/recipes` (features may not import each other); the Filters sheet is a `formSheet` route in the Recipes stack, under the `LibraryRoot` that keeps filters across the tRPC remount. `hostOf` moved to `lib/network`.
- Added three i18n keys in every locale (`recipes.dashboard.importingCard`, `recipes.empty.descriptionMobile`, `common.filters.minRating`) because the boards' text differs from web's. The list row also shows the favourite heart (the board draws it in the grid only; the spec says both views).
- Left for later tickets: cookbook cards open nothing and the Cookbooks empty state has no "New cookbook" button (14); `Today` is the list header slot (11); swipe and menus (10). Not checked on a device: the formSheet's glass, the heart/tag overlay and the tab-accessory clearance (72 pt) need the simulator pass.

### Review log (2026-11-13)

Implementation `bd0b63408..eb5b6ec3d`, fixes `f7c05d78b..440f98ce6`. Standards on Sonnet low, Spec on Opus medium, and one simulator check of tickets 08 and 09 against the boards (iPhone 18 Pro, light only).

Fixed:
- Web regressions from the move, each with a test that failed first: the Library search text reached the filter cookie; a storage read that throws no longer fell back to the defaults. `f7c05d78b`, `1191c1e93`
- The filter dot counts Minimum rating, one shared rule for web and mobile. `65afeff78`
- Shared, with every copy switched: the allergen set, the cover mosaic rule, the card facts with the description. `29844f5e9`, `31d561237`, `f35fc4b36`
- The `footer` pill size's name, `formatMessage` called directly in Filters, a dropped memo. `31d561237`, `2b04bfc32`, `440f98ce6`
- From the device check, built from the board sources and not yet seen on a device: the Filters sheet (title inside the scroll content, 20 pt inset, solid pinned footer, the board's opening height), the avatar as a bare 36 pt disc, the no-results ink colour, the pending card's spinning arc. `e9b0b2516`..`c46d21cc3`

Checked, no change needed: `LibraryList`'s `testID` has a caller; Sign-out's confirm only appears with unsynced work, as on the smoke screen; web's cookbook cover renders byte-identical after the mosaic move; the memo in `recipe-tags.tsx` stays because lint reports the compiler skips the component without it.

Rejected: the row/grid fork in the cards (it follows the boards); the favourite mark's size prop (trivial); the 4-6 pt offset of the system-drawn tab bar and accessory.

Open for the device pass (both simulators were held by stale device sessions): the signed-in screens stayed light with the simulator in dark, and no cause could be proven from the code; the four board fixes above; the pending card; a cold start that showed the splash for over 10 seconds against a freshly started dev server.

Asked and answered (maintainer, 2026-11-13): list rows keep the favourite heart, although the board draws it only in the grid.

Final state `440f98ce6`: all 11 gates exit 0, mobile lint has no warnings.
