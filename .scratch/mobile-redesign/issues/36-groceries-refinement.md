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

- Add/edit grocery are fit sheets (`FIT_SHEET_OPTIONS`; their steps are `SheetBody`s, so the height follows the step): on the iPhone 17 they ride up with the keyboard with no jump, glass, light and dark, also at the largest accessibility text (the tall edit sheet reaches the top and draws near-opaque there). The focus ring was clipped by the scroll body's missing top padding; `pt-1` on every `Sheet` body fixed it.
- A multi-detent sheet that gets the keyboard is expanded by UIKit to full height and drawn opaque; a single 0.62 detent is lifted to the top edge and also drawn opaque. Search sheets (Add to pantry, plan-recipe, Add to cookbook, cookbook add recipes, new cookbook) use `SEARCH_SHEET_OPTIONS`, one 0.5 detent: glass, lifted by the keyboard, two to five rows visible above it. Import text and Manage stores keep two detents and still expand with the keyboard.
- Pantry: the accessory has an "Add to pantry" entry; the sheet reuses `usePantryField`/`usePantryCatalogue`. A custom row shows only when no found food is named as typed (`foodNamedAsTyped`, the rule `canAdd` uses; it folds case, accents and notes, not plurals), and Return keeps that food. The field is capped at the server's length. The Pantry's field only filters.
- Motion: only rows new to the list fade in (`useFreshRows`: not on first load, scroll or drop); a ticked row with Done folded leaves towards its Done row on the app's spring and shrinks (`useLeaveToDone`; a fade under Reduce Motion), and the count pops. Seen in recorded frames only as the row shrinking at its slot; the flight is too fast for the recording's frame rate. Drag haptics and Reduce Motion are not seen on a simulator.
- Maestro `pantry-add-from-sheet` taps the exact milk and checks the server holds the catalogue milk and the custom tahini; 5 of 5 on fresh servers (a reused server fails: the first run's tahini becomes a catalogue food). add-to-groceries passes.
- Simulator (iPhone 17, iOS 27.2): rings checked focused and unfocused on Add/Edit grocery, the Store step, Servings (second field), rename cookbook, Add to cookbook, plan-recipe, new cookbook (second field), import text and Add to pantry, in dark (light for add grocery and Add to pantry); planned item, Plan this recipe and pantry food have no field. Not seen: editor choice, light mode of the others, drag pickup/drop, a refused tick reverting, and the Pantry's accessory minimised: the Groceries tab's bar did not minimise on scroll in automated scrolls (Recipes did). Frames and shots are in scratchpad `t36/round2/`.
