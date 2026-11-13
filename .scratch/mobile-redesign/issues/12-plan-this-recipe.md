# 12: Plan this recipe

**What to build:** Web's mini calendar for planning a known recipe, used by Plan on a card and Move… on Today, and the after-planning preference on both plan sheets. See `.scratch/mobile-redesign/spec.md` Part 2 ("Planning and groceries") and ticket 07's Plan this recipe board.

**Blocked by:** 10, 11

**Status:** open

- [ ] Moved first, in separate commits, web switched over with its unit tests: the range and plan step of `mini-calendar.tsx` and `useAfterPlanning` (`after-planning.tsx`) with its `PlannedGroceries` servings default.
- [ ] Days from last month to next month, opened on today; each day card shows what's planned and has an add per slot. The day card is a component the Calendar area can reuse.
- [ ] Plan plans and closes; Move moves the Today item and closes.
- [ ] Both plan sheets follow `getAfterPlanningPreference`: nothing, open Add to groceries (ticket 13), or add at once.
- [ ] The sheet paints cached days or a skeleton in its first frame, and is glass with no solid footer.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
