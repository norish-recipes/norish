# 11: Today

**What to build:** Today's four slots at the top of Recipes and the Plan a recipe sheet behind an empty one. See `.scratch/mobile-redesign/spec.md` Part 2 ("Today") and the Home, HomeMiniRecipes and HomeModal boards plus ticket 07's Today boards.

**Blocked by:** 09

**Status:** done

- [x] Moved first, in separate commits, web switched over with its unit tests: `todays-meals-helpers.ts` and `-constants.ts` (slot grouping, `nextMealSlot`, titles), the visibility filter and week range of `todays-meals-content.tsx` as a hook, the ticking date of `useReaderToday`, and the planning logic of `mini-recipes.tsx` (slot to category, random, note).
- [x] Four slots Breakfast to Snack, opened on the next meal, per `todaySectionVisibility`; notes as cards.
- [x] An empty slot's add card opens Plan a recipe for today and that slot: slot tabs, recipe search, Random recipe, note.
- [x] Long-press: Open recipe, Move… (wired to ticket 12's sheet), Remove with the native alert.
- [x] Today paints cached slots or a skeleton in its first frame; the Plan a recipe sheet is glass with no solid footer.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Moved into shared-react: `calendar/todays-meals.ts` (helpers, slots; deep export `@norish/shared-react/calendar/todays-meals` so skeletons stay light), `useTodaysMeals`, `useSlotPlanning` (random is passed in, as a domain imports no other) and `reader/useToday`. Web's tests that mocked `shared-react/calendar` now fake the package's own `use-calendar-*` files by path.
- Plan a recipe is a new `plan-recipe` formSheet (0.785 detent matches the board's top edge) with the board's day strip (today + 13) as well as slot tabs; it does not yet follow the "after planning" preference (tickets 12/13). Move... pushes the `plan` placeholder with `plannedItemId`.
- The native large title sits below the nav row, so Today's date and cards are about 60 pt lower than the board; kept for the collapsing header. Title is "Recipes" when Today is hidden. Not seen on a device: the first-frame skeleton, a dark Plan sheet, offline.
