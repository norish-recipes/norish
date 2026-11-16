# 36: Groceries refinement

**What to build:** The grocery sheets, the Pantry's add sheet and the list's motion. See `.scratch/mobile-redesign/spec.md` Part 6 ("Rules", "Groceries").

**Blocked by:** 34

**Status:** open

- [x] The add and edit sheet keeps its own height when the keyboard opens and rides up on it, with no jump to the full detent.
- [x] No field's focus ring or edge is clipped on any sheet (Mike, 2026-11-16: seen on the new-cookbook sheet too, "a lot of items have this with inputs"): fixed once in the shared `Sheet` body and `SheetInput`, not per sheet, and every sheet with a field checked on the simulator, focused and unfocused.
- [x] On Pantry the accessory reads Add to pantry and opens a sheet that searches existing Ingredients and adds one of them or a custom entry; the Pantry's top field only filters.
- [x] Motion: a checked item springs into Done; sections and rows animate in, out and on reorder; pickup and drop haptics on drag.
- [x] Maestro: add a food to the Pantry from the sheet.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- Add/edit grocery are fit sheets (`FIT_SHEET_OPTIONS`; their steps are `SheetBody`s, so the height follows the step). A fit sheet is as tall as its content up to the room under the native header (70 pt below the safe-area top) and above the keyboard; past that `SheetBody` scrolls and the actions stay pinned. The cap comes from the window and the keyboard only, so no layout feeds it. `SheetBody` keeps an empty view first, because react-native-screens stretches a sheet's first-child scroll view to the whole sheet.
- Seen on the iPhone 17: the 20-aisle step scrolls to its last aisle; at the largest text the edit form and Import text (`FIT_SHEET_FIELD_HEIGHT`, 200 pt) sit at the top above the keyboard, their actions visible and their frames unchanged over 3 s. Not seen: the product step (the seed's store had no product row), light mode this round.
- Search sheets (Add to pantry, plan-recipe, Add to cookbook, cookbook add recipes, new cookbook, Manage stores, the editor's choice) use `SEARCH_SHEET_OPTIONS`, one 0.5 detent lifted by the keyboard. No sheet with a field keeps two detents.
- Pantry: the accessory has an "Add to pantry" entry. A custom row shows only when no found food is named as typed (`foodNamedAsTyped`, built on `textNamesFood`, the rule `pantryIngredientFor` uses: any of the food's names, plurals and a note counted), and Return keeps that food. Keeping a food gives the success haptic in `useKeepingField`, which both the sheet and the Pantry's suggestion rows use; the haptic is not felt on a simulator. The Pantry's field only filters.
- Motion: a row fades in only the first time the list shows it after its first load (`useFreshRows`), including the first item into an empty list. A ticked row with Done folded flies to where its Done row will be once the row has left (`useLeaveToDone`), and shrinks; the count pops. The flight, drag haptics and Reduce Motion are not seen on a simulator.
- Each tab list sits in `TabListMarker`, so the bottom accessory minimises on Groceries, Pantry and Calendar as on Recipes, and still does on Groceries after a visit to the Pantry and on Calendar after an item sheet. Its bottom iOS edge effect is off; the list's own fade stays. Recipes after a recipe was not seen.
- Maestro on the iPhone 17: add-to-groceries, pantry-add-from-sheet, cookbook-create-add and plan-from-today pass. Shots are in scratchpad `t36/round4/`.
