# 05: Desktop modifier selection

**What to build:** Cmd/Ctrl-click on a recipe card toggles it in or out of the selection, starting selection if the reader was not selecting. Shift-click selects every recipe card from the anchor (the last clicked card) to the clicked one, in the grid's current on-screen order and among loaded cards. Cookbook and pending cards in the range are skipped.

See `.scratch/library-selection/spec.md`.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] E2E: Cmd/Ctrl-click starts selecting and toggles a card without navigating
- [ ] E2E: Shift-click selects the range between anchor and target, skipping cookbook cards
- [ ] Gates green
