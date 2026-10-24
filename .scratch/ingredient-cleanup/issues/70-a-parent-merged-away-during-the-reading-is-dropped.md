# 70: A parent merged away while the reading is out is dropped

**What to build:** Found by ticket 31's run after tickets 51-53, 65, 67, 68 and ticket 60's round 2 (2026-10-23, HEAD 814c23937, `m68_post_on`). A food sat under an own food. While AI was reading the food, a parallel job merged that own parent, sure and rightly, into a seeded food, so the food moved under the seeded food. AI then named the old parent, and ticket 65's rule answered with the parent row `askAIAbout` loaded before the reading. That row was gone by then, so `findCatalogueIngredient` found nothing, and the pass took the answer as "no parent" and removed the seeded parent the food now had, sure. Last run the two readings ran in the other order and the food kept its parent.

On the copy: 1 food, 1 recipe line.

To decide: an answer whose parent is gone is looked up again, or the food is left as it is.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

"it should still find biefstuk and file it under beef steak". An answer whose parent food is gone by the time it is applied looks the parent's name up again; the merge moved its spellings, so the lookup finds the food it merged into. One rule for any parent AI names, not only the current one.

## Implemented (2026-10-23)

- The `own` answer carries `parent: { id, name } | null` (was `parentId`); `parentOf` names it by the current parent's name (ticket 65 and the kept AI parent), AI's parent, or the category that found it.
- `askAIAbout` (`review.ts`), the only place a parent answer is applied, re-finds a parent whose row is gone by that name through `findFoodNamed` (`foundAgain`); the merge moved its spellings, so it finds the food it merged into. Not found stays no parent.
- Test: `review.test.ts` "finds the parent AI names again when a merge took it away while AI was reading" merges biefstuk into beef steak inside the mocked reading.
- No release-notes line: the AI pass and ticket 65's rule are new in 0.26, so this is a fix inside unreleased behaviour.
