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
- Title is "Recipes" when Today is hidden. The first build used the native large title, which put Today about 60 pt below the board; the review replaced it (see the log). Not seen on a device: the first-frame skeleton of Today, offline.

### Review log (2026-11-13)

Implementation `94f935a38..0d9aa81c2`, fixes `d64a3dab5..1039933a7`. Standards on Sonnet low and Spec on Opus medium; the implementer and the fixer each checked the screens on the iPhone 18 Pro against the boards in light and dark; then Spec on Opus medium again over the fix range.

Fixed:
- The header follows the board: "Today" and the date on the avatar's band (title line box at y 68-109, the board's; avatar at 346, 66 against 346, 68), a centred inline title over the system's fade once scrolled. A transparent native header carries the avatar; the Recipes tab manages its own content insets for it. `638dc37d4`
- Today's range follows the date. The hook kept the week it mounted with, so an app left open into a new week showed an empty Today; web had the same rule and gets the same fix. `d64a3dab5`
- Today re-opens on the next meal on return from the background and on a day change; Plan a recipe's selected day follows today until one is picked. `4c5feb867`, `b67242e1c`
- Plan a recipe: skeleton rows in the first frame, a virtual list as the sheet's scroll view, heroui-native tabs, search field and buttons, a native glass close button. `26315b2a8`
- One card size, one `isRecipeItem`, one `usePlannedItemText` (web switched), per-card actions from `useTodayActions(item)`, the slot chip and `+n` badge as native glass capsules as the board source draws them. `2700245ab`, `e0058f1a1`, `e206d73c4`, `d58fb9c10`, `5872706ea`
- The content title is a header for VoiceOver. `4b5b4d7f8`

Checked, no change needed: the moves changed nothing on web (planning sheet, today's meals and the reader's date compared line by line; every case of the deleted `next-meal-slot` test carried over); the range change refetches nothing while today stays in its week; the re-open ignores `inactive` and never fights a drag; the header change does not reach the cookbook route or the sheets.

Rejected: an optimistic Today entry for a plan queued offline (web shows it after replay too, and offline works as on web).

Left with a named ceiling: the list's bottom padding adds a fixed 49 pt for the tab bar, so the end of the Library has that much extra space once the bar minimises; no documented inset follows the minimised bar.

Not seen on a device: Today's and the Plan sheet's skeleton (cached data paints at once), the re-open on resume and at midnight (unit-tested), offline.

Final state `1039933a7`: all 11 gates exit 0, mobile lint has no warnings.
