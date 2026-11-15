# 26: Pantry

**What to build:** Pantry on mobile. See `.scratch/mobile-redesign/spec.md` Part 4 and the Groceries board's `pantry`, `pantrySearch` and `pantryEmpty` views and the food sheet.

**Blocked by:** 24

**Status:** open

- [x] Pantry list, search, empty state; the food sheet with only the pantry switch (no ingredient management).
- [x] Writes through the Outbox.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: Moved first, own commits, web switched and its tests green: `searchPantry` (filter and order) and `uncoveredSuggestions` into `@norish/shared/lib/pantry`, the debounced catalogue search into `usePantryCatalogue` (shared-react), `usePantryQuery().isRead` (data held, as ticket 24's fix), and `IngredientIcon` from the recipe feature to `components/` (a feature may not import another). Put-on-the-list stays two lines in the screen (create, Undo deletes) as web's; not moved.
- Decided: the Pantry is the route `groceries/pantry`, reached from a glass switch in the title row (also on the list), fading in; the food sheet is `groceries/food?id=` as a fit sheet with the switch as a draft and Save (the board), taking the food out on Save; rows, field, hint, catalogue matches, "From your recipes" (open when the Pantry was empty at first read, folded otherwise, Show more) follow the board and web. No new strings (all under `groceries.pantry` and `groceries.page`). The Pantry list is in the Warm Set, so a relaunch paints it from cache; with an empty Warm Set and no server it shows a skeleton, then web's "could not be read" text, never the empty state. A food with no icon leaves an empty icon slot where the board draws a grey circle (the shared IngredientIcon, also on the recipe screen). Ticket 30: docs for the Pantry and its switch.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey, light and dark): list, search with a hit and with "No results found", the empty state, the food sheet's switch taking Salt out (the grocery for it stayed on the list) and the cart button putting it on ("On the list" chip, toast with Undo). With the server stopped: a typed add and a switch-off showed at once, survived a kill and relaunch, and were stored when it returned (server pantry: olive oil, paprika, soy sauce). Cold launch with the cache file removed and no server: skeleton, then the unreadable text. Not seen: catalogue matches (the throwaway server has no catalogue) and ingredient icons. Note for later sessions: the Expo dev client's floating gear button swallowed taps on the switch until dragged aside.
