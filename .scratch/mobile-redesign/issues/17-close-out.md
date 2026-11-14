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

### Maintainer feedback on the Recipes tab (2026-11-14), open

Mike, on the simulator. One fixer takes all five once ticket 16's fix round frees the checkout and the device.

1. Today: the slot tags (Breakfast, Lunch, Dinner, Snack) at the top left of each slot are not fixed in place; they move as the page scrolls.
2. The header does not need to follow the scroll: it stays at the top of the page and scrolls away with it. No sticky header.
3. The long press opens faster.
4. A long press shows the swipe actions for a moment as the menu opens and as it closes.
5. Tags and chips are plain white, so on a sheet that can be pulled to full height they match the sheet's background and lose their contrast; the same on the mini calendar and the other sheets that can be enlarged. They take a fill that reads on the glass sheet and on the full-height one (as ticket 15 did for a sheet's secondary action).
