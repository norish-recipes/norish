# 68: An other name that is a plural of the parent counts as the parent

**What to build:** Left open by ticket 63 (2026-10-22). Ticket 63 merges a food into its parent when one of AI's other names folds equal to the parent AI gives. A plural ("guajillo chilies" for parent "guajillo chili") is compared as text and does not count.

**Blocked by:** None

**Status:** superseded by 69

## Decided (Mike, 2026-10-23)

A plural counts. The other name and the parent are compared with the slip matcher (`name-slips.ts`) the lookup already uses, not a plural rule of its own. Checked on 2026-10-23: it takes "guajillo chilies", "onions", "tomatoes" and "red bell peppers", and misses short or irregular ones ("eggs", "chilies", "bay leaves", "cherries"); those stay as ticket 63 has them.

## Implemented (2026-10-23)

- `parentNamed` in `readThenLookUp` takes an other name that folds equal to AI's parent or that `slipsNear` (`@norish/shared/lib/name-slips`) finds within a slip of it. The exact fold check stays because `slipsNear` returns nothing under five letters.
- Test: `review.test.ts` "merges a food into the parent AI gives when an other name is that parent's plural" (guajillo chilies). Ticket 63's release-notes sentence names the plural; ADR-0037 amendment.

## Superseded (2026-10-23)

Undone by ticket 69 (Mike): the slip matcher cannot tell a plural from another food a letter apart ("broccolini" for broccoli). `parentNamed` is fold equality again, the plural test, release-notes wording and ADR-0037 amendment are gone.

## Later (2026-10-23)

The plural now counts through ticket 63's comparison, which moved to `sameFood` (plural and diminutive endings, read whole), not the slip matcher. See ticket 63's "Changed".
