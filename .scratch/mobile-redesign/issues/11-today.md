# 11: Today

**What to build:** Today's four slots at the top of Recipes and the Plan a recipe sheet behind an empty one. See `.scratch/mobile-redesign/spec.md` Part 2 ("Today") and the Home, HomeMiniRecipes and HomeModal boards plus ticket 07's Today boards.

**Blocked by:** 09

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: `todays-meals-helpers.ts` and `-constants.ts` (slot grouping, `nextMealSlot`, titles), the visibility filter and week range of `todays-meals-content.tsx` as a hook, the ticking date of `useReaderToday`, and the planning logic of `mini-recipes.tsx` (slot to category, random, note).
- [ ] Four slots Breakfast to Snack, opened on the next meal, per `todaySectionVisibility`; notes as cards.
- [ ] An empty slot's add card opens Plan a recipe for today and that slot: slot tabs, recipe search, Random recipe, note.
- [ ] Long-press: Open recipe, Move… (wired to ticket 12's sheet), Remove with the native alert.
- [ ] Today paints cached slots or a skeleton in its first frame; the Plan a recipe sheet is glass with no solid footer.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
