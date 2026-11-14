# 19: Shared drag list

**What to build:** One drag list for Groceries, Manage stores and the Calendar tab. See `.scratch/mobile-redesign/spec.md` Part 4 ("Gestures", "The drag list").

**Blocked by:** 18

**Status:** open

- [ ] Checked first: `react-native-reorderable-list` on RN 0.88 / Reanimated 4.7 with headings as non-draggable rows; else built on Gesture Handler and Reanimated. The choice and its reason go in this ticket's comments.
- [ ] A flat list with heading rows; hold lifts a row, a drop reports the row and the heading above where it landed.
- [ ] Haptic on lift and drop, auto-scroll near the edges, Reduce Motion fallback; a tap still reaches the row.
- [ ] Proven on the simulator in a throwaway screen that is removed again; no feature uses it yet.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments
