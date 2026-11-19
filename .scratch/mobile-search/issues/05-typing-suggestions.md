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
