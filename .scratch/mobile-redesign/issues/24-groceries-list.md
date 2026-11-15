# 24: Groceries list

**What to build:** The Groceries tab without drag. See `.scratch/mobile-redesign/spec.md` Part 4 and the Groceries boards (`view`, `overlay`).

**Blocked by:** 23

**Status:** open

- [x] Moved first, in separate commits, any web-only list glue the tab needs (grouping, view mode), with unit tests.
- [x] Store, recipe and grouped views, Unsorted first, Aisle headings, store-coloured checkboxes, prices and sale, empty state.
- [x] Tap the checkbox ticks; a tap on the row opens the edit sheet (store product and price, store, aisle, repeat, Delete/Save); no long-press menu.
- [x] "Add items" accessory and sheet (item, store, repeat with plain-words detection, add another); the Repeat sheet; clear done or the whole list.
- [ ] First frame from the Warm Set or a skeleton; writes through the Outbox.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- 2026-11-15: Moved first (own commits, web switched, tests moved or added): shelf price formatting, line pricing and `useGroceryPrice`, aisle blocks (`placeInAisles`) and recipe grouping, the name/ingredient/aisle hooks of the add and edit panels (`useSettledName` extracted), the repeat pattern edits and `recurrenceTranslationsFrom`, the source breakdown text, and `useGroceryEdit` (web's save/delete branches). Decided: Repeat, Store and Aisle are views inside the add/edit sheet (close goes back) and both sheets use the two detents; Unsorted first and only while it holds a line; the done tail folds per section; the list is flat `DragRow` rows with headings, no drag wired.
- Left out: Pantry switch, Manage stores (gear item and store options), Store Product picker and purchase amount (ticket 26/27), drag (25). The product shows read-only in the edit sheet. Ticket 30: docs for the tab and its gear menu; strings are under `groceries.mobile`.
- Simulator (iPhone 18 Pro, iOS 27.2, light and dark, Metro on :8089, server on :3000 as left running): store view with aisles, prices and sale, by-recipe view, add with "every week" detected and taken, edit sheet saving a store and an aisle (line moved under Dairy & eggs), Repeat view, tick into the done tail; my throwaway line deleted, the view preference put back. Second pass (own server on :3400, throwaway Postgres and Valkey; iPhone 18 Pro, iOS 27.2, dark and light for the first checks): (a) the empty state shows in the by-recipe view of an empty list; the by-store view keeps the Store's section with its aisles. (b) Delete done and Clear list (with its confirm) both work. (c) a milk grouped from a recipe and by hand expands to its two sources; ticking one gives the dash on the group, ticking the group moves it to the done tail; the Store-coloured ring, check and dash are RoundTick's now. (d) With the server stopped after one load: a tick, an add and an edit show at once and survive a kill and relaunch offline; after the server came back the tick and the add were stored, the edit was not (the app went back to the old name). An edit made online saves, so this is the queued-write replay left to the maintainer's pending decision, untouched here; the box stays open for it. (e) A first launch with an empty Warm Set and the server stopped shows the skeleton and keeps it, never the empty state. Seen and left: the empty state's cart icon is near-black on the dark tile.
