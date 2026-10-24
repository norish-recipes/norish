# 69: An other name a slip from the parent is another food

**What to build:** Found by ticket 31's run after tickets 51-53, 65, 67, 68 and ticket 60's round 2 (2026-10-23, HEAD 814c23937, `m68_post_on`). Ticket 68 compares AI's other names with its parent through `slipsNear`. For a specific broccoli, AI gave the parent "broccoli" and the other name "broccolini", and `slipsNear` finds "broccolini" within a slip of "broccoli". So the name counted as its parent, and both foods were merged into broccoli, sure. Last run both were own foods under broccoli (ticket 56's rule). The same check rightly merged "guajillo chile" into guajillo chili.

On the copy: 2 foods, 4 recipe lines.

To decide: does the slip check take only the plural shapes ticket 68 was about, or does an other name that is another known food never count as the parent?

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

Undo ticket 68: an other name counts as the parent only when it folds equal to it (ticket 63 as built), no slip check. The slip matcher cannot tell a plural from another food one letter apart ("broccolini"). Ticket 68 becomes superseded.

## Implemented (2026-10-23)

- `parentNamed` in `readThenLookUp` (`ingredient-resolution.ts`) compares other names to AI's parent by `foldName` equality only, as ticket 63 built it; the `slipsNear` import is gone.
- Test: `review.test.ts` "files tenderstem broccoli under broccoli: its other name broccolini, a slip of broccoli, is not broccoli" replaces 68's guajillo chilies test (it merged before the fix). Release notes and ADR-0037 back to ticket 63's wording. Ticket 68 marked superseded.

## Later (2026-10-23)

Ticket 63's comparison moved from fold equality to `sameFood` read whole, so a plural or other inflection of the parent counts; "broccolini" still does not, and this ticket's test stays green. See ticket 63's "Changed".
