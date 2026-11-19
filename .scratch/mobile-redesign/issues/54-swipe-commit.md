# 54: Swipe actions full-swipe commit

**What to build:** `swipe-actions.tsx` per spec Part 8 and the canvas `DeleteMotion` board: solid coloured circles; a full swipe commits the outermost action (Delete), which stays a circle and follows the card edge while the other circles drop away; the card slides off and the row closes. Today a full swipe runs `actions[0]` (the innermost), so the order or the commit target changes.

**Blocked by:** 50

**Status:** ready

- [ ] Full swipe commits Delete on recipe cards and settings rows; the confirm (if any) behaves as today.
- [ ] Motion on the UI thread; Reduce Motion skips the slide.
- [ ] Unit test for which action a full swipe commits; gates green.

## Comments
