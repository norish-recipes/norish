# 10: Card actions

**What to build:** Swipe and context-menu actions on every recipe and cookbook card. See `.scratch/mobile-redesign/spec.md` Part 2 ("Card actions") and the HomeSwipe board. The sheets the actions open come in 12–14; until then those actions are wired to the routes those tickets fill.

**Blocked by:** 09

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: the ownership rule `userId ? canX(userId) : true` (five web components) and the mutation toasts (`hooks/use-recipes-mutations.ts`: queued offline vs safe error).
- [ ] Swipe in list and grid: Groceries, Plan, Delete, per the board's circles.
- [ ] Native context menu: Favourite/Unfavourite, Groceries, Plan, Add to cookbook, Delete, and Remove from cookbook inside a cookbook.
- [ ] Delete only when permitted, confirmed with the native alert.
- [ ] Double-tap the photo toggles Favourite with a light haptic.
- [ ] Cookbook cards: Add recipes, Rename, Delete.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
