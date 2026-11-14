# 24: Groceries list

**What to build:** The Groceries tab without drag. See `.scratch/mobile-redesign/spec.md` Part 4 and the Groceries boards (`view`, `overlay`).

**Blocked by:** 23

**Status:** open

- [ ] Moved first, in separate commits, any web-only list glue the tab needs (grouping, view mode), with unit tests.
- [ ] Store, recipe and grouped views, Unsorted first, Aisle headings, store-coloured checkboxes, prices and sale, empty state.
- [ ] Tap the checkbox ticks; a tap on the row opens the edit sheet (store product and price, store, aisle, repeat, Delete/Save); no long-press menu.
- [ ] "Add items" accessory and sheet (item, store, repeat with plain-words detection, add another); the Repeat sheet; clear done or the whole list.
- [ ] First frame from the Warm Set or a skeleton; writes through the Outbox.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
