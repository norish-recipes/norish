# 05: Typing suggestions and Narrow to

**What to build:** The typing state (board SrTyping): a "Search for '…'" row, 2 recipe suggestions and "Narrow to" rows for Ingredients, Tags and Categories.

**Blocked by:** 04

**Status:** done

- [x] Server: one suggestion procedure for the typed text returns up to 3 Ingredients (name or any Ingredient Alias, folded as the ingredient catalogue folds; only foods named by recipes the reader can see; most-used first), 3 Tags and 3 Categories whose names match, visible ones only. Repository tests for alias matching, visibility and order.
- [x] Recipe suggestions are `library.list` with the same text, Search Scope and filters, limit 2, so a suggestion is the top of the results. Debounced as the web field is.
- [x] The "Search for" row and the keyboard's search key confirm; a recipe suggestion opens the recipe inside Search; a Narrow-to row adds its chip (04 for Ingredients, existing Tag and Category filters), clears the text and shows Results. The title hit is highlighted on a client prefix match.
- [x] Ingredient rows show the Ingredient Icon unless Hidden Items hides icons.
- [x] Unit tests for the confirm/narrow rules; i18n in every locale; gates green.

## Comments

Implementation (2026-11-20):
- Server: `library.suggest({ text })` returns `{ ingredients: [{ id, name, localeNames }], tags, categories }` (`listLibrarySuggestions`, `library.ts`). Matching is a word-start prefix ("chick" finds "Rotisserie chicken", "hicken" nothing), folded with the catalogue's own `folded`/`holds` (now exported) over every Ingredient Alias fold, Tag and Category names; most-used = distinct visible recipes naming the food (any spelling), then name. The client shows `ingredientDisplayName(localeNames)` and the icon by id through the icon cache, as other rows do. Categories match their stored (English) names only; a localized label is not searched.
- Debounce is 300 ms as web's field (web has a literal, no shared constant; `SUGGESTIONS_DEBOUNCE_MS`). Recipe suggestions are `useLibraryList({ limit: 2, sortBeatsRank, filters + settled text })`; text with no search word asks nothing. Skeleton rows stand for both sections while either read or the debounce is pending.
- An entry already applied as a chip is hidden, not shown as applied (`narrowRows`). The rules live in `utils/search-suggestions.ts` and `search-field.ts` (`narrowed` event; the row confirms with `submitted`, as the key does). The highlighter moved to `lib/highlight-segments.ts` + `components/highlighted-text.tsx` so Search can use it.
- Deviations: the board draws 3 recipes, the spec says 2 (followed the spec); `SectionLabel` (13 pt, sentence case) and `CardRow` stand in for the board's uppercase 12 pt heading and `.li` (CardRow's `label`/`hint` now take a node); Category rows use an `apps-outline` tile (no board); chips are not drawn above the typing state (board has none).
- Not done: nothing seen on a device; the first-frame skeleton has not been measured.

Fix round (2026-11-20):
- Server: an Ingredient matches by its own name or any Alias (the catalogue's `matchingSearch`, word-start, with its `lower()` fallback, also for Tags); a parent is suggested and counted by the distinct visible recipes naming it or any kind, walking only from the text matches. Categories come back as every one on a visible recipe; the client matches the label the Filters sheet shows (`matchingCategories`) and shows that label. One search-text schema serves `library.list` and `library.suggest`.
- Client: no Ingredient rows at the 20-chip limit; reads run only while the typing state shows; `useSettledText(text, delay)` in `shared-react/settled-text` replaces both debounces; the contract's `LibrarySuggestionsDTO` replaces the copy; skeletons are `CardRow`s with distinct test ids and one `SuggestionSection`; `HighlightedText` replaces `HighlightedTitle`. Tests drive the real store, field hook and `useAddIngredient` (`narrow-to.test.tsx`).
- Device (iPhone 18 Pro, iOS 27.2, Release build, light and dark, throwaway stack): typing, skeleton heights, both confirm paths, recipe open/back, parent narrow (kind recipes), two chips and ×, every match line, `basil ^`, Hidden Items icons, leaving to Recipes and back all matched the boards; nothing needed a code fix.
- Board deviations left: 2 recipe suggestions, `SectionLabel` headings, Category tile icon; cards are the Recipes tab's grid, not the board's list.
- Not fixed: a Recipes-tab card with no text shows its raw description markdown ("**bold**"), not this ticket's code. The Maestro flows were not run (no `maestro` on this machine).

Review (2026-11-20), range `a63f3333e..39330543e`, two review rounds and a device pass:
- fixed, round 1 (`1be90c49a..6bfa03dd3`): an Ingredient matches on its own name, its locale names or any alias (the catalogue's predicate); a food is suggested when narrowing to it would return a recipe, kinds included, counted in distinct visible recipes; Categories match and show the reader's label; no Ingredient rows at the 20-Ingredient limit; suggestion reads only in the typing state; wiring tests through the real store; one `useSettledText` debounce; the contract type, `CardRow` skeletons, one section component, one names query, `HighlightedText`.
- fixed, device pass (`5f411c737`, `ce652c98f`): Search results always use the list card (a grid preference cut the match line); card descriptions are plain text, on the Recipes tab too.
- fixed, round 2 (`d20d49c71..39330543e`): `library.suggest` caps its text at 200 again (`SUGGEST_TEXT_MAX`) and the client skips the read beyond it; applied Categories are removed before the cap of 3; the narrow-to test reads the real state.
- rejected: narrowing giving no results under other chips (the spec scopes suggestions to visible recipes, not current filters; the no-results state offers Clear filters); per-keystroke query cost and categories re-read per text (grouped reads over a household's library).
- decided here, not in the ticket: suggestions follow the filter, so a parent food is offered when only its kinds are named (user stories 3 and 4).
- device (iPhone 18 Pro, iOS 27.2, Release, light and dark): typing, Narrow to, chips, every match line, Hidden Items and ticket 02's flows pass. Board deviations left: 2 recipe suggestions (the spec's number), `SectionLabel` headings, the Category row's tile icon.
