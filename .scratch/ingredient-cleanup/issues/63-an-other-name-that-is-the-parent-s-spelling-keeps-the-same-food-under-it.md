# 63: An other name that is the parent's spelling keeps the same food under it

**What to build:** Found by ticket 31's run after tickets 57, 58 and 60 (2026-10-22, HEAD 67eb2082a, `m60_post_on`). Ticket 57 narrowed ticket 56's rule to a food that AI's other names or a slip find and that is the reading's parent: that food becomes the parent, never the merge target. Here AI read a plural own food with a parent that is the same food in the singular, and gave that parent's seeded spelling as an other name. The rule filed it under the parent, so the copy keeps a near-duplicate. Last run, with the parent one level up, it merged.

On the copy: 1 food, 3 recipe lines.

To decide: is an other name that is the parent's own spelling, with nothing in the English name to tell them apart, AI saying "this is that food" (merge), or does ticket 57's rule stand?

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-22)

"build all 4". An other name that is the parent AI gives is AI saying the food is that food, so it merges, as the English name finding it does. The run's case bears it out: "guajillo peppers" read as englishName "guajillo pepper", parent "guajillo chili", otherNames ["guajillo chile", "guajillo chili"], sure.

## Implemented (2026-10-22)

- In `readThenLookUp` (`ai/resolution/ingredient-resolution.ts`) the merge before the parent lookup also fires when one of AI's other names folds (`foldName`) equal to the parent AI gave: then the name is the food the names found, and the parent is not looked up. No new query. An other name that only finds the parent by another of its spellings ("salsiccia" for sausage, "pureed pumpkin" for pumpkin) still files the name under it, so tickets 56/57 hold.
- Compared as text, not by the lookup: an other name that is a plural of the parent ("guajillo chilies" for parent "guajillo chili") does not count.
- Test: `review.test.ts` "merges guajillo peppers into guajillo chili, an other name AI gives being the parent it gives".
- The release-notes line on ticket 56's rule and an ADR-0037 amendment say so.

## Changed (2026-10-23)

- In m70a/m70b guajillo stayed filed under guajillo chili: AI's other names were "guajillo chiles" (a slip, Decision 0.84) and "guajillo chile" (found exactly through Italian's i/e plural ending), never "guajillo chili" folded, and ticket 69 had taken out 68's slip check. Mike's earlier "a plural of the parent counts" now holds through the spelling keys rather than the slip matcher.
- `parentNamed` uses `sameFood(name, parent, rules, true)` (`@norish/shared/lib/spelling-keys`) with the resolver's built rules (`currentRules`, now exported). `sameFood`/`foodKeys`/`foodKey` take a `whole` flag that keeps size and preparation words, as AI's names are looked up (ticket 50), so "sliced ham" is not ham and "petite potatoes" not potato. "guajillo chile" and "guajillo chiles" both count, through the Italian i/e ending; "broccolini" still does not.
- Test: `review.test.ts` "merges guajillo peppers into guajillo chili, AI's other name guajillo chile being that parent in another inflection" (m70b's reading); `spelling-keys.test.ts` pins the `whole` flag. Release-notes sentence and ADR-0037 amendment updated.
