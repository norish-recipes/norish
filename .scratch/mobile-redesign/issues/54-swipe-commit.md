# 54: Swipe actions full-swipe commit

**What to build:** `swipe-actions.tsx` per spec Part 8 and the canvas `DeleteMotion` board: solid coloured circles; a full swipe commits the outermost action (Delete), which stays a circle and follows the card edge while the other circles drop away; the card slides off and the row closes. Today a full swipe runs `actions[0]` (the innermost), so the order or the commit target changes.

**Blocked by:** 50

**Status:** done

- [x] Full swipe commits Delete on recipe cards and settings rows; the confirm (if any) behaves as today.
- [x] Motion on the UI thread; Reduce Motion skips the slide.
- [x] Unit test for which action a full swipe commits; gates green.

## Comments

- Ticket 54: a full swipe now runs `fullSwipeAction` (the last action, Delete when offered); past the open width that circle closes on the card edge with a 1.15 pop while the others shrink and fade (`dropAway`).
- Only recipe cards use `SwipeActions`; no settings row swipes, so nothing else changed. The confirm is untouched: the row closes, the alert asks, Cancel leaves the card back.
- A confirmed delete: the card slides off (260 ms) with the Delete circle on its edge, then a list row collapses (350 ms, no overshoot); grid cards skip the collapse. All Reanimated shared values; Reduce Motion deletes at once.
- Maestro swipes are partial (open only) and tap the circles, so no flow changed. Ticket 55 checks the motion on device.
- Review round 1 (Standards on Hydrogen, Spec on Opus), dispositions:
  1. fix (bug): the collapse height can stick to a recycled or restored cell (`swipe-actions.tsx:140-142` returns `{}` when not leaving, leaving the last height 0 on the view; `onLayout` then stores 0). Always return the height key (undefined when not leaving) and never store a 0 height from a collapsed state. Test the style logic as a pure function if the mocked Reanimated can't show it.
  2. fix: per board, the Delete circle stops at the card's edge position (x 98 on the board) when the card slides off, pops 1 -> 1.15 -> 1, then shrinks to 0.3 and fades while the rows rise; today it leaves with the card (`:138`).
  3. fix: the pop settles at 0.95 (`0.8 + 0.43*0.35`) though the comment says 1, and the drag pop stays at 1.15 (`1 + 0.15 * drop`, `:380`); both return to 1 as the board does. Name the shared value and its numbers after what they scale.
  4. fix: drop-away runs over a fixed 64 pt (`swipe-reveal.ts:42`) while the commit point can come earlier (`fullSwipeAt`); it completes at the commit point (scale over `fullAt - width`). Test it.
  5. fix: the confirmed delete slides off from rest because the row closes before the alert (`:251`). Hold the card at the full-swipe position while the confirm alert is up; Confirm slides it off from there, Cancel springs it back closed. One timer, delete once.
  6. fix: the leaving Delete circle duplicates `ActionButton` (`:197`, `:266-271` vs `:384`, `:397-402`); render through `ActionButton`.
  7. fix: `actionOffset` JSDoc is three lines (`swipe-reveal.ts:11-13`).
  8. fix: `8 + (208 / 3) * count` and `208 / 3` (`:78-80`) state the step twice; derive width from step.
  9. fix: `variant === "list"` decides the collapse in three places (`:141`, `:156`, `:166`); one `collapses` flag.
  10. fix: `const commit = fullSwipeAction(actions)` (`:248`) names an action with a verb; rename.
  11. fix: `actionOffset(travel, width, index, count, step, reduceMotion)` passes three Layout fields loose; pass the layout.
  12. reject: a full swipe commits Plan when Delete isn't offered: the rule is "the outermost action", as Mail does.
  13. kept for ticket 55: grid cards clip to their column while sliding off (`:207`); judged on the device.
- Round 1 fixes: all but 12 (rejected) and 13 (ticket 55) done in one commit. A full-swipe Delete now holds the card (`held`) for the confirm: Confirm slides it off from there, Cancel springs it back (`restore`, via `useConfirm`'s `onCancel`).
- The leaving overlay circle is gone: the panel's own Delete circle stays on the held edge and shrinks/fades (`gone`), so one `ActionButton` draws it. Menu deletes slide the card off without a circle.
- `collapseHeight` always returns the height key (undefined when not collapsing); `dropAway` finishes at `fullAt`; `actionOffset` takes a `Reveal`. Maestro flows only open the row, so none changed; the motion is for the device pass in ticket 55.
- Re-review of the fix range (Opus), dispositions:
  1. fix (bug): a FlashList cell reused after a delete shows every swipe action invisible: the done timer resets `held` but not `slide`/`gone` (`swipe-actions.tsx:181-183`), and `ActionButton` reads `motion.extra` without checking `leaving`, pinning `travel` at `fullAt`. Reset all leave state when the leave finishes, and `extra` is 0 when not leaving.
  2. fix: a held card whose recipe disappears (realtime delete while the alert is up) leaves `held=1`/an open row on the reused cell; reset swipe state when the cell's item changes.
  3. fix: board timing: the circle shrinks and the rows rise ~350 ms after the slide starts (board keyTimes .4583-.5167 vs slide .3667-.4417); the code starts both at SLIDE_MS (260).
  4. reject: delete from the long-press menu or partial swipe + tap leaves with no circle: the board draws the circle only for the full swipe.
- Exit gate on `7dd002b8d`: all six gates exit 0 (fixer's run; i18n unchanged since its green run).
