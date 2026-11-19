# 54: Swipe actions full-swipe commit

**What to build:** `swipe-actions.tsx` per spec Part 8 and the canvas `DeleteMotion` board: solid coloured circles; a full swipe commits the outermost action (Delete), which stays a circle and follows the card edge while the other circles drop away; the card slides off and the row closes. Today a full swipe runs `actions[0]` (the innermost), so the order or the commit target changes.

**Blocked by:** 50

**Status:** ready

- [x] Full swipe commits Delete on recipe cards and settings rows; the confirm (if any) behaves as today.
- [x] Motion on the UI thread; Reduce Motion skips the slide.
- [x] Unit test for which action a full swipe commits; gates green.

## Comments

- Ticket 54: a full swipe now runs `fullSwipeAction` (the last action, Delete when offered); past the open width that circle closes on the card edge with a 1.15 pop while the others shrink and fade (`dropAway`).
- Only recipe cards use `SwipeActions`; no settings row swipes, so nothing else changed. The confirm is untouched: the row closes, the alert asks, Cancel leaves the card back.
- A confirmed delete: the card slides off (260 ms) with the Delete circle on its edge, then a list row collapses (350 ms, no overshoot); grid cards skip the collapse. All Reanimated shared values; Reduce Motion deletes at once.
- Maestro swipes are partial (open only) and tap the circles, so no flow changed. Ticket 55 checks the motion on device.
