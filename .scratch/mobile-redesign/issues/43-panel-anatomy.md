# 43: One panel anatomy

**What to build:** Every sheet places its actions, height and fields the same way. See spec Part 7 ("Rules", "Sheets").

**Blocked by:** none

**Status:** ready

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
