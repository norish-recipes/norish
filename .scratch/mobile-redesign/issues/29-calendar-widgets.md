# 29: Calendar widgets

**What to build:** The small (current meal) and large (seven days) widgets, push only. See `.scratch/mobile-redesign/spec.md` Part 5 ("Widgets") and ticket 18's widget boards.

**Blocked by:** 22, 28

**Status:** open

- [ ] An entry builder (pure, unit-tested): which meal per `nextMealSlot`, fall-forward within today, today plus 13 days, entries at midnight, 10:00 and 14:00.
- [ ] The app pushes at launch, on foreground and on every calendar change it sees, realtime included; photos written to the shared folder.
- [ ] Small and large widgets per the boards, with their tap targets; signed out and run-out lines; Sign-out clears them.
- [ ] Checked by hand on a device in light, dark, tinted and clear.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
