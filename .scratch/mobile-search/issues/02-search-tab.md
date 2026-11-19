# 02: The Search tab: field, results and Search Scope

**What to build:** Replace the Search placeholder (`apps/mobile/src/app/(tabs)/search.tsx`) with the page's rested, focused and results states (boards SearchPage, SrFocused, SrResults, SrNone), on today's server. See the spec's Mobile section.

**Blocked by:** none (the sort chip sends `sortMode`; 01 makes it apply while searching)

**Status:** ready-for-agent

- [ ] The `role="search"` tab becomes a stack that shares the recipe routes (`recipe/[id]/*`, and the sheets they open), so a result opens inside Search and back returns to the results with the scroll kept.
- [ ] Search's own filter store (a second `LibraryFiltersProvider`, not persisted), separate from the Recipes tab's. The funnel opens the existing Filters sheet bound to Search's store, with a count badge.
- [ ] Field behaviour: confirming (keyboard search key) shows Results; **×** dismisses the keyboard and keeps everything; **⊗** clears the text; leaving and returning keeps query, chips, scope and sort for the session. A pasted URL is just text.
- [ ] Search Scope row: glass toggle chips (Title, Ingredients, Tags, Description, Steps) above the field, only while it has text; Title and Ingredients by default; at least one stays on; a change re-runs the search.
- [ ] Results: filter chips with ×, the sort chip (Best match while there is text, otherwise Newest; Newest, Oldest, A–Z, Z–A), the recipe count, the Recipes tab's library card, recipes only, paginated as the Library list is.
- [ ] No results: Clear filters (keeps the text) / Search all fields (narrowed scope) / "No recipes match '…'".
- [ ] The state rules (which state shows, the scope rule, the no-results variant) in plain modules with unit tests; i18n keys in every locale.
- [ ] Gates green.

## Comments
