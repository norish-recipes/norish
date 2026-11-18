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
