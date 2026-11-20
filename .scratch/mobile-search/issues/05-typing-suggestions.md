# 05: Typing suggestions and Narrow to

**What to build:** The typing state (board SrTyping): a "Search for '…'" row, 2 recipe suggestions and "Narrow to" rows for Ingredients, Tags and Categories.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Server: one suggestion procedure for the typed text returns up to 3 Ingredients (name or any Ingredient Alias, folded as the ingredient catalogue folds; only foods named by recipes the reader can see; most-used first), 3 Tags and 3 Categories whose names match, visible ones only. Repository tests for alias matching, visibility and order.
- [ ] Recipe suggestions are `library.list` with the same text, Search Scope and filters, limit 2, so a suggestion is the top of the results. Debounced as the web field is.
- [ ] The "Search for" row and the keyboard's search key confirm; a recipe suggestion opens the recipe inside Search; a Narrow-to row adds its chip (04 for Ingredients, existing Tag and Category filters), clears the text and shows Results. The title hit is highlighted on a client prefix match.
- [ ] Ingredient rows show the Ingredient Icon unless Hidden Items hides icons.
- [ ] Unit tests for the confirm/narrow rules; i18n in every locale; gates green.

## Comments

Implementation (2026-11-20):
- Server: `library.suggest({ text })` returns `{ ingredients: [{ id, name, localeNames }], tags, categories }` (`listLibrarySuggestions`, `library.ts`). Matching is a word-start prefix ("chick" finds "Rotisserie chicken", "hicken" nothing), folded with the catalogue's own `folded`/`holds` (now exported) over every Ingredient Alias fold, Tag and Category names; most-used = distinct visible recipes naming the food (any spelling), then name. The client shows `ingredientDisplayName(localeNames)` and the icon by id through the icon cache, as other rows do. Categories match their stored (English) names only; a localized label is not searched.
- Debounce is 300 ms as web's field (web has a literal, no shared constant; `SUGGESTIONS_DEBOUNCE_MS`). Recipe suggestions are `useLibraryList({ limit: 2, sortBeatsRank, filters + settled text })`; text with no search word asks nothing. Skeleton rows stand for both sections while either read or the debounce is pending.
- An entry already applied as a chip is hidden, not shown as applied (`narrowRows`). The rules live in `utils/search-suggestions.ts` and `search-field.ts` (`narrowed` event; the row confirms with `submitted`, as the key does). The highlighter moved to `lib/highlight-segments.ts` + `components/highlighted-text.tsx` so Search can use it.
- Deviations: the board draws 3 recipes, the spec says 2 (followed the spec); `SectionLabel` (13 pt, sentence case) and `CardRow` stand in for the board's uppercase 12 pt heading and `.li` (CardRow's `label`/`hint` now take a node); Category rows use an `apps-outline` tile (no board); chips are not drawn above the typing state (board has none).
- Not done: nothing seen on a device; the first-frame skeleton has not been measured.
