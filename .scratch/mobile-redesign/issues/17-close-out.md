# 17: Maestro, docs and release notes for the Recipes tab

**What to build:** The Recipes tab's acceptance run and its docs. See `.scratch/mobile-redesign/spec.md` Part 2 ("Testing Decisions").

**Blocked by:** 16

**Status:** open

- [ ] Maestro flows: browse and filter, plan from Today, plan from a card, add to groceries, cookbook create and add, import from a link, delete, Recipes offline.
- [ ] One full Maestro run after tickets 08–16 are reviewed and fixed; each new flow run repeatedly to prove it stable.
- [ ] Offline replay (Outbox) and realtime coverage return on Recipes flows, replacing the smoke-screen flows ticket 08 removed; the grocery check returns with the Groceries area.
- [ ] Device run of every Recipes board against the canvas.
- [ ] Docs (the mobile app page in `apps/docs`, iPhone screenshots of Recipes and the Share Extension) and the 0.27.0-beta release notes line, written by Terra.
- [ ] Gates green.

## Comments

### Maintainer feedback on the Recipes tab (2026-11-14), done 2026-11-14

Mike, on the simulator. One fixer takes all five once ticket 16's fix round frees the checkout and the device.

1. Today: the slot tags (Breakfast, Lunch, Dinner, Snack) at the top left of each slot are not fixed in place; they move as the page scrolls.
2. The global header (the "Recipes" title with the user's avatar) does not need to follow the scroll: it stays at the top of the page and scrolls away with it. Today, scrolling down animates "Recipes" to a centred title in a faded bar; neither should happen (no collapsing title, no bar appearing over the content). Not the "Your recipes" row.
3. The long press opens faster.
4. A long press shows the swipe actions for a moment as the menu opens and as it closes.
5. Tags and chips are plain white, so on a sheet that can be pulled to full height they match the sheet's background and lose their contrast; the same on the mini calendar and the other sheets that can be enlarged. They take a fill that reads on the glass sheet and on the full-height one (as ticket 15 did for a sheet's secondary action).

Done on the simulator (captures in `device-feedback/`):

1. Slot tags: the native glass host lagged behind the page's vertical scroll, so the tag drifted off its corner; `PhotoChip` is now a plain view (RN white 85% pill) that moves with its slot. Glass on those two chips is gone.
2. Header: the title and avatar were a native transparent header plus a collapsing title; they are now list content on the Recipes screen (native header off for that screen), so they scroll away. Groceries, Calendar and Settings have no header, so nothing to change there.
3. Long press: not changed. It is iOS's own context menu (`Link.Menu`), its delay is fixed by the system and the package exposes no option.
4. Swipe actions showing on long press: the actions panel sits behind the card and showed through it while the card lifted; the panel is now clear until the swipe progress is above 0 (grid and list checked).
5. Sheet controls: chips, day cards, rows, fields, tiles, stepper and the grocery section take `bg-default` instead of `bg-surface` (inner icon circles and photo placeholders swapped the other way); checked on every Recipes sheet at both heights, light and dark. Page chips (lenses, Filters, card pills) are white on the cream page and show no problem.
