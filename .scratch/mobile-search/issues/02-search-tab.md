# 02: The Search tab: field, results and Search Scope

**What to build:** Replace the Search placeholder (`apps/mobile/src/app/(tabs)/search.tsx`) with the page's rested, focused and results states (boards SearchPage, SrFocused, SrResults, SrNone), on today's server. See the spec's Mobile section.

**Blocked by:** none (the sort chip sends `sortMode`; 01 makes it apply while searching)

**Status:** ready-for-agent

- [x] The `role="search"` tab becomes a stack that shares the recipe routes (`recipe/[id]/*`, and the sheets they open), so a result opens inside Search and back returns to the results with the scroll kept.
- [x] Search's own filter store (a second `LibraryFiltersProvider`, not persisted), separate from the Recipes tab's. The funnel opens the existing Filters sheet bound to Search's store, with a count badge.
- [x] Field behaviour: confirming (keyboard search key) shows Results; **×** dismisses the keyboard and keeps everything; **⊗** clears the text; leaving and returning keeps query, chips, scope and sort for the session. A pasted URL is just text.
- [x] Search Scope row: glass toggle chips (Title, Ingredients, Tags, Description, Steps) above the field, only while it has text; Title and Ingredients by default; at least one stays on; a change re-runs the search.
- [x] Results: filter chips with ×, the sort chip (Best match while there is text, otherwise Newest; Newest, Oldest, A–Z, Z–A), the recipe count, the Recipes tab's library card, recipes only, paginated as the Library list is.
- [x] No results: Clear filters (keeps the text) / Search all fields (narrowed scope) / "No recipes match '…'".
- [x] The state rules (which state shows, the scope rule, the no-results variant) in plain modules with unit tests; i18n keys in every locale.
- [ ] Gates green.

## Comments

Part A (2026-11-19):
- Route: `(tabs)/(recipes)` became `(tabs)/(recipes,search)` (Expo Router array group), one `_layout` that picks `RecipesStack` or `RecipesStack Root={SearchRoot} root="search"` by `segment`; anchors per group in `unstable_settings`. The tab trigger is now `(search)`. Absolute hrefs (`/recipe/[id]`, `/plan-recipe`) resolve against the current group, so they stay in Search.
- State: `features/search/components/search-root.tsx` is the second `LibraryFiltersProvider`; text (`rawInput`), scope (`searchFields`), sort (`sortMode`, start `none`), chips all live in that store and are mirrored to module scope in `utils/search-session.ts` (also `confirmed`, via `useSearchConfirmed`/`setSearchConfirmed`). Not wiped at sign-out: `lib` may not import a feature; wire `resetSearchSession` where Recent Searches get wiped (ticket 05).
- Narrowed scope = any of the five fields off, so the default pair is narrowed and "Search all fields" (`ALL_SCOPE`) is offered. Last field can't be turned off (`toggleScope`), unlike `toggleSearchFieldIn`.
- Seams for Part B: `utils/search-state.ts` (`searchView`, `noResultsVariant`, `hasSearchFilters`), `search-scope.ts`, `search-sort.ts` (`sortOptions`, `shownSort`), `hooks/use-search-field.ts`, `screens/search-screen.tsx` (renders `Results` = `recipes/components/recipe-results.tsx`, handed in by the route file since features can't import each other). `LibraryCards` still draws its own no-results from `hasAppliedRecipeFilters` (text counts); Part B needs an override. `clearFilters` also clears the text.
- Unverified on device: Cancel (×) restoring the text UIKit clears (`use-search-field.ts`), the native field refilling after a remount, and the shared-route resolution; the simulator check must cover them. No i18n keys added (the placeholder reuses `recipes.dashboard.searchRecipesPlaceholder`).

Part B (2026-11-19):
- Decided: `search-session.ts` moved to `lib/` (a feature can't be imported by `lib/end-session.ts`, which already clears timers and widgets); `endSession` calls `resetSearchSession`, tested. Store gained `keepOnClear`: Search sets text, scope and sort, so both the empty-state button and the Filters sheet's Clear keep them (Recipes' clear is unchanged). `LibraryCards` takes an optional `noResults` that replaces its text-counts-as-filter card.
- Board deviations: sort icon is Ionicons `swap-vertical`; cooking-time chips read "<30 min" (existing keys), rating chip "4+ stars"; funnel is a custom bar element (the native item drew twice next to the search bar) with the accent badge; placeholder keeps the existing "Search recipes..." key.
- Device (iPhone 18 Pro, iOS 27.2, Release): UIKit hides the nav bar while search is active (fixed with `hideNavigationBar={false}`); the tab accessory covered the Scope row, so Search shows none unless a timer runs. Cancel emits its event before the empty text (Part A assumed the reverse): the empty text after a Cancel is now ignored; the native × also leaves for the Recipes tab (UIKit), and query, results, chips, scope and sort were all there on return. Shared-route resolution and the field refill after return work.
- Not done: the Scope row sits under the accessory while a timer runs; sign-out wipe checked by unit test only, not on device. Gates: `pnpm test:run` fails at default turbo concurrency on `worklet-closures` drag-list (5 s timeout under load, untouched file, passes alone and with `--concurrency=2`), so "Gates green" stays unticked.

