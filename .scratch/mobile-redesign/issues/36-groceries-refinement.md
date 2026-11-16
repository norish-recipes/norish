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

- Decided: add/edit grocery use one fixed 0.5 detent (`FORM_SHEET_OPTIONS`, no grabber, no expand-on-scroll): on the iPhone 17 UIKit then lifts the sheet with the keyboard at its own height; with the old [0.62, 1] it jumped to the full detent. The focus ring was clipped by the scroll body's missing top padding; `pt-1` on every `Sheet` body fixed it for all sheets.
- Pantry: the accessory table has an "Add to pantry" entry (`/groceries/pantry-add`), so a plan always holds an action and `AccessoryPlan.add` lost its null; the sheet reuses `usePantryField` and `usePantryCatalogue`, and `pantryAddRows` (tested) lists found foods then the typed text, unless a found food is named so. The Pantry's field only filters.
- Motion: rows and headings fade in/out with a spring layout on the drag list; the Done count pops when a line joins it; the tick presses with a scale and a light haptic. Drag lift/drop haptics already existed in `use-drag-events`; they cannot be felt on a simulator.
- Maestro `pantry-add-from-sheet` failed once in five (the typed row shows before the catalogue's answer and is replaced); it now waits for the found food's row, then passed 5 of 5. add-to-groceries and timer-from-accessory pass.
- Simulator (iPhone 17, iOS 27.2): checked Add/Edit grocery (light, dark; keyboard riding up), new cookbook, import link, store editor (dark), Pantry accessory (alone, beside a timer), Pantry add sheet (found + custom food, light and dark), the filter, and a tick into Done recorded in frames. Unseen: Servings, rename/add to cookbook, plan/planned item, import text, editor choice, pantry food sheets' rings, drag pickup/drop, Reduce Motion, the accessory minimised. Frame sheets are in scratchpad `t36/`.
