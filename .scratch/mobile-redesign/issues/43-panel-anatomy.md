# 43: One panel anatomy

**What to build:** Every sheet places its actions, height and fields the same way. See spec Part 7 ("Rules", "Sheets").

**Blocked by:** none

**Status:** ready

- [ ] No pinned action buttons: filters, imports, share, manage-stores, pantry, planned-item, edit-grocery, grocery-sheet and product-step move theirs into the header (confirm, glass items or a header menu). `Sheet.Actions` goes if nothing uses it.
- [ ] Filters: Apply is the header confirm, Clear filters a glass header item.
- [ ] List and search sheets (Plan recipe and the other `SEARCH_SHEET_OPTIONS` sheets) take [0.5, full]; content-fit sheets stay fixed.
- [ ] `SheetInput` and `SheetSearchField` share one style: `bg-default`, fully rounded, no ring.
- [ ] Maestro flows updated where a button moved; gates green.
