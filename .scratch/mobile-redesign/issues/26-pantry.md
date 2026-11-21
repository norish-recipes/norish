# 26: Pantry

**What to build:** Pantry on mobile. See `.scratch/mobile-redesign/spec.md` Part 4 and the Groceries board's `pantry`, `pantrySearch` and `pantryEmpty` views and the food sheet.

**Blocked by:** 24

**Status:** done

- [x] Pantry list, search, empty state; the food sheet with only the pantry switch (no ingredient management).
- [x] Writes through the Outbox.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: Moved first, own commits, web switched and its tests green: `searchPantry` (filter and order) and `uncoveredSuggestions` into `@norish/shared/lib/pantry`, the debounced catalogue search into `usePantryCatalogue` (shared-react), `usePantryQuery().isRead` (data held, as ticket 24's fix), and `IngredientIcon` from the recipe feature to `components/` (a feature may not import another). Put-on-the-list stays two lines in the screen (create, Undo deletes) as web's; not moved.
- Decided: the Pantry is the route `groceries/pantry`, reached from a glass switch in the title row (also on the list), fading in; the food sheet is `groceries/food?id=` as a fit sheet with the switch as a draft and Save (the board), taking the food out on Save; rows, field, hint, catalogue matches, "From your recipes" (open when the Pantry was empty at first read, folded otherwise, Show more) follow the board and web. No new strings (all under `groceries.pantry` and `groceries.page`). The Pantry list is in the Warm Set, so a relaunch paints it from cache; with an empty Warm Set and no server it shows a skeleton, then web's "could not be read" text, never the empty state. A food with no icon leaves an empty icon slot where the board draws a grey circle (the shared IngredientIcon, also on the recipe screen). Ticket 30: docs for the Pantry and its switch.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey, light and dark): list, search with a hit and with "No results found", the empty state, the food sheet's switch taking Salt out (the grocery for it stayed on the list) and the cart button putting it on ("On the list" chip, toast with Undo). With the server stopped: a typed add and a switch-off showed at once, survived a kill and relaunch, and were stored when it returned (server pantry: olive oil, paprika, soy sauce). Cold launch with the cache file removed and no server: skeleton, then the unreadable text. Not seen: catalogue matches (the throwaway server has no catalogue) and ingredient icons. Note for later sessions: the Expo dev client's floating gear button swallowed taps on the switch until dragged aside.
- 2026-11-15, review round: Save on the food sheet with the switch off closed the Pantry too (the sheet's own `back()` plus the "food gone" effect); a ref now stops the effect after Save, test first. Leaving the Pantry is `dismissTo("/groceries")` and the Groceries stack anchors on `index`, so a cold `norish:///groceries/pantry` has the list under it. The field takes focus after an add, as web. One card `Edge` type and `edgeAt`; the Groceries title row and `SkeletonCard` are shared with the Pantry (the list has no field, so there is no field shell to share); `usePantryField` and `usePutOnTheList` moved to shared-react and web uses them (own commits); `usePantryScreen` and `PantryRowView` split the screen; `SUGGESTIONS_SHOWN` (also web's copy) and `hasNameContaining` name what they hold. `useThemeColor` stays: 72 other places use it for `muted`/`foreground`/`accent-foreground`, and they resolve in light and dark on the device.
- Boards, item 4: Groceries draws "Add items" only when not Pantry, so the Pantry has no tab accessory (also hidden under the food sheet). Item 5: `pantrySearch` hides both the hint and "From your recipes" while the field has text, which mobile already did; unchanged. Item 6: boards draw "Ingredients you already own." under the field (every non-search view) and "Most used ingredients" under the open "From your recipes" label; both stay. Item 7: boards draw a 28 pt grey circle (`--default`) for a food without an icon, on the Pantry, matches, suggestions and the recipe editor; the Recipe board has no icon-less line, so the recipe screen keeps its `namesNoFood` rule.
- Simulator (iPhone 18 Pro, iOS 27.2, own server :3400, throwaway Postgres and Valkey, four foods given a shipped icon by SQL): Save with the switch off lands on the Pantry with Salt gone; cold deep link to the Pantry and its switch to the list; cursor back in the field after an add; icons beside grey circles, aligned, on the Pantry and on a recipe, light and dark; no accessory on the Pantry, "Add items" on the list. Not seen: catalogue matches (no catalogue on the throwaway server).

### Review log (2026-11-15)

Range `e74bd0469..aca5d3257` (`85e02c628` and `c67afdb7b` in it are the Outbox exclusion, not this ticket). Standards on Sonnet low, Spec on Opus medium; fixes `5054e9340..aca5d3257`. The Spec review found the moves out of web, the pantry's effect on the grocery list (ticket 13's sheet already splits lines by it), offline and the first frame clean.

Fixed (10): Save on the food sheet with the switch off also closing the Pantry; leaving the Pantry from a deep link; the cursor back in the field after an add; one card `Edge` type and helper; the title row and skeleton card shared with the Groceries list; the field's add rules and put-on-the-list shared with web; the screen split into a hook and a row view; a lookup table for the note rows; two names and a comment.

Settled by the boards (4): no accessory on the Pantry or under the food sheet; the two hint lines stay; "From your recipes" hides while the field has text; a food without an icon draws the 28 pt grey circle, in the shared icon component.

Kept after checking: heroui-native's `useThemeColor` for heroui's own tokens (72 other callers, right in light and dark).

Rejected (3): the `ingredients` domain importing `../offline/react` (lint enforces the cross-domain rule and passes); the food screen as a middle man; commit subjects a few characters over 70.

Open for ticket 30's device run: catalogue matches in the Pantry search and real ingredient icons (the throwaway server had neither).

Final state `aca5d3257`: all 11 gates exit 0, mobile lint without warnings.
