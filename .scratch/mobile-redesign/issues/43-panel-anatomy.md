# 43: One panel anatomy

**What to build:** Every sheet places its actions, height and fields the same way. See spec Part 7 ("Rules", "Sheets").

**Blocked by:** none

**Status:** done

- [x] No pinned action buttons: filters, imports, share, manage-stores, pantry, planned-item, edit-grocery, grocery-sheet and product-step move theirs into the header (confirm, glass items or a header menu). `Sheet.Actions` goes if nothing uses it.
- [x] Filters: Apply is the header confirm, Clear filters a glass header item.
- [x] List and search sheets (Plan recipe and the other `SEARCH_SHEET_OPTIONS` sheets) take [0.5, full]; content-fit sheets stay fixed.
- [x] `SheetInput` and `SheetSearchField` share one style: `bg-default`, fully rounded, no ring.
- [x] Maestro flows updated where a button moved; gates green.

## Comments

- `Sheet` takes `confirm` and `secondary` (`ModalHeader`): one secondary action is a glass header item (red when destructive), several share one "Actions" header menu. `Sheet.Actions` and the pinned slot are gone. Confirms: Filters Apply (Clear filters = glass item), imports Import (AI import = glass sparkles item), photos Import with AI, share Create link, manage stores Add store, planned item Save (menu: Go to recipe, Groceries, Remove in red, same confirm alert), edit grocery Save (Delete = red glass item), repeat step Done (Remove = red glass item), product step Done (Type the price = glass pencil item, gone once typing).
- [0.5, full] with grabber: every `SEARCH_SHEET_OPTIONS` sheet (Plan recipe, manage stores, pantry add, cookbook pickers, editor choice); fit sheets and the 62% sheets (filters, share, add to groceries) are unchanged. On the device the sheet goes full and opaque with the keyboard up, the header confirm stays reachable; a slow drag returns it to half.
- `SHEET_FIELD` (bg-default, no shadow, no focus outline) is shared by `SheetInput`, `SheetSearchField`, the link field and the text area. The Pantry page's `ring` field keeps `bg-surface`: it is a page on an opaque ground, not a sheet.
- Decided: planned item's three actions are one menu with Save as the only confirm (Go to recipe lost its primary button); a header item cannot show a spinner, so Create link just disables while creating.
- Seen: the planned item's title truncates ("Thai curry noodle so...") beside the menu item. Grouped rows and thumbnails from ticket 42 have their translucent fill in both themes on every sheet checked.
- Not done: no photo was imported (the simulator has only a library) and the import sheets were exercised with an invalid link, not a real import.
- Gates on `73e9a392e` (the implementer skipped `test:run` and `build`): all seven exit 0.
- Review round 1 (Standards + Spec), dispositions:
  1. fix: Add to groceries keeps Select all/Deselect all in the body; the spec names it as a glass header item.
  2. fix: Plan this recipe (a list of days) stays at [0.62, 1]; list sheets take [0.5, full].
  3. fix: the field style is half shared: `SHEET_FIELD` holds the fill only, height and rounding are written per field, the import-link field is 52 pt where the others are 48, and import-link and import-text hand-write the classes. One definition, a multiline form of it for the text import.
  4. fix: Planned item's Go to recipe moved from the main button into the Actions menu; the recipe row in the sheet opens the recipe. (My call: one tap, no pinned button.)
  5. fix: Edit grocery's Delete is a trash icon beside Save and has no confirmation; a destructive action lives in the header menu, as Remove does on Planned item, written once. (My call.)
  6. fix (bug): Create link greys out only after the next render, so a second tap can create a second link; the shared confirm ignores presses while its action is pending.
  7. fix: "Import with AI" touches the sheet's right edge on the photo import.
  8. fix (verify on device): the last row of a full-height list sits under the home indicator (`sheet.tsx:34`, `pb-4`, no safe-area bottom).
  9. fix: the product step's title truncates to "Product at Albert H…"; the title keeps the part that tells sheets apart.
  10. fix (verify): ten testIDs were dropped and flows tap by visible text; `calendar-remove.yaml` ends on `point: 68%,57%`. Header items carry testIDs where the platform exposes them.
  11. fix: no test presses the grocery Delete or the repeat step's Remove after the move.
  12. fix: title, confirm and secondary travel as loose props re-declared in `GrocerySheet`, `RecipeSheetGate` and `PickSheet` (`confirm={action}`); one object, as `useImportActions` already returns.
  13. fix (verify): `recipe-share-screen.tsx` now reads the id from the route with a new `?? null` case; `SheetSearchField` owns a `ring` variant only the Pantry page uses; `ModalHeader`'s `onClose`/`back` options; the `Sheet` mock in `product-step.test.tsx` puts one testID on every secondary action.
  14. fix: screenshots: "zzt" test grocery in the Edit grocery shots (remove it from the dev data if it is still there), the repeat step in dark with its trash, Plan recipe back at half height.
  15. reject: an Arabic screenshot; the header is native and mirrors.
- Review round 1 fixes: Select all is a glass icon item on Add to groceries (To buy, else Pantry); Delete lives in the Edit grocery Actions menu through the shared `destructiveAction` (Planned item's Remove too), the repeat step's Remove repeat stays a glass item; the planned item's recipe row (thumbnail, title, chevron) opens the recipe and Go to recipe left the menu; Plan this recipe is [0.5, full]; one `SHEET_FIELD` (48 pt capsule) plus `SheetTextArea`, the Pantry passes its own look; wrappers pass one `SheetActions`; scrolling bodies end above the home indicator; the product step is titled with the store's name.
- The shared header ignores a press while its async action runs or the item is disabled (Create link). Photo import confirms with a checkmark labelled "Import with AI", which fits the header.
- Header testIDs: native header items (`_UIButtonBarButton`) and menu entries expose no identifier to the accessibility tree on iOS 27 (`identifier` on the item was set and not seen), so flows tap by label; `calendar-remove` taps the alert's Remove by `index: 1`, and `import-link` waits for the sheet to settle before tapping Import.
- `recipe-share-screen` reads the id from the `[id]` route (always set), so the `?? null` case is gone; `ModalHeader`'s `onClose`/`back` both have callers (`Sheet`). Dev data checked: no "zzt" grocery, test data removed.
- Exit gate on `98c0d55e1`: all seven gates exit 0 (before round 2's fixes).
- Review round 2 (the fix range), dispositions:
  1. fix (bug): the press guard holds only when the handler returns its promise; `add-to-groceries-screen.tsx:152` and `add-to-cookbook-screen.tsx:51` wrap theirs in `void`, so a double tap adds or saves twice. Every confirm returns its promise.
  2. fix: a rejected action leaves an unhandled rejection (`modal-header.tsx:83`, `void result.finally(...)`); the test covers resolve only.
  3. fix (bug, verify): Plan this recipe sometimes opens on past days (`plan-calendar-dark.png`): `initialScrollIndex` is applied once and the offsets are estimated before the plan's data settles, and ignore the list's top padding.
  4. fix: the grocery `NameField` overrides the shared field with `h-[52px] text-[17px]` (`form-parts.tsx:37`).
  5. fix: the repeat step's Remove is hand-built beside the shared action shape (`grocery-sheet.tsx:168-176`); it stays a header item (it clears a setting), built from the shared piece.
  6. fix (verify): Planned item shows the recipe's name twice, in the header and in the recipe row.
  7. fix: `calendar-remove.yaml` picks the alert's Remove by `index: 1`; a selector that does not depend on order.
  8. fix: `calendar.timeline.goToRecipe` has no reader left in any app but sits in every locale.
  9. ask (Mike): Add to groceries had a Select all per section (To buy, In pantry); the one header item covers To buy, or In pantry only when nothing is to buy.
  10. reject: one busy flag per header blocking the secondary items while a confirm runs; one action at a time is the point.
  11. reject: `recipe-servings-screen.tsx`'s `text-lg font-semibold` on its number; the field's fill, height and rounding come from the definition, the weight is content.
  12. reject: the bottom inset staying under the keyboard (about 34 pt of extra scroll); no visible defect.
  13. kept: Edit grocery's Delete as the only entry of an Actions menu; the extra tap is the guard a delete without confirmation needs.
- Round 2 fixes: Plan this recipe opened on past days because a refetch grew the cards above today after the list mounted (and the offsets ignored the list's `pt-1`); it now scrolls back to today after each change until the first drag, and ten opens in both themes (cold and warm) all showed Today. Finding 8 does not hold: web's `edit-planned-recipe-panel.tsx` still reads `calendar.timeline.goToRecipe`, so the key stays.
- Every confirm now returns its promise (Add to groceries, Add to cookbook, New cookbook); the others are synchronous and close the sheet. The header releases its guard with `then(release, release)`, leaving no second rejected promise. Planned item for a recipe is titled "Edit Planned Recipe" (existing key) since its recipe row carries the name. Remaining: Add to groceries' Select all (9) is with Mike.
- Mike 2026-11-18: Select all stays per section; it acts on a section, not the sheet. (Round 2 finding 9: the pill is back in each section heading; the header keeps Close, the title and Add.)
- Round 2 #8 not fixed, rightly: web's `edit-planned-recipe-panel.tsx:87` still reads `calendar.timeline.goToRecipe`. #9 answered by Mike: Select all per section (`f7119a8a8`).
- Exit gate on `94ff16b24`: all seven gates exit 0. Carried to ticket 45: in `planned-item-dark.png` the slot switch shows no thumb behind the selected slot. For Mike on the phone: Delete as the one entry of Edit grocery's Actions menu, the recipe row on Planned item, the half and full detents while typing, a real photo import and a real link import (the simulator had neither).
- Sheets whose look changed (the iPhone guides' screenshots): Filters, the three imports, Share, Planned item, Edit grocery and its repeat step, the product step, Manage stores, the store editor, Add to pantry.
