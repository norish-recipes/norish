# 53: AI drops a right parent when its names do not find it

**What to build:** Found by ticket 31's run after tickets 32-48 (2026-10-22, HEAD fa3fb4295, `m48_post_on`). With AI on, 2 own foods lost a right parent, sure, and 1 went under a wrong one:

- A lean chicken mince food was under the own food kipgehakt. AI's parent was "chicken mince"; no food is named or spelled that (kipgehakt has only Dutch spellings), so the parent was removed.
- An unflavored protein powder was under protein. AI gave no parent and the category "protein powder"; the own food "protein powder" exists (two flavoured powders went under it in the same pass), but the category was not found, so the parent was removed.
- A bouillon cube got no parent and the category "seasoning", which found mixed spices.

On the copy: 3 foods. Ticket 27 keeps a parent the food shares; here AI names the current parent in other words, and the lookup misses it.

**Blocked by:** None

**Status:** done

## Decided (Mike, 2026-10-23)

"build all except 66". When AI names a parent or a category and the lookup finds nothing, the food keeps the parent it has instead of losing it. A null parent and null category from AI still remove it. The bouillon cube under mixed spices is left.

Follow-up (Mike, 2026-10-23, on whether "peanut butter" under butter should keep butter when AI names the unfound "spread"): "only when a person or AI chose it — our new algorithm should be much better." The kept parent is only one a person or AI chose; a parent from the words is dropped as before.

## Implemented (2026-10-23)

- `readThenLookUp` returns the current parent as the "own" answer's `parentId` when AI named a parent or a category, neither lookup found a food, and `filedUnder.byAI` holds; otherwise null, so `askAIAbout` drops the parent as before. With ticket 65 it is one rule, said in `readThenLookUp`'s doc comment.
- "A person chose it": `parentChosen` foods are not askable (`askableByAI`), so they never reach the reading; the first start's `unmarkChosenParents` (step 7 of `first-start-cleanup.ts`, before the AI pass) clears 0.25's marks, so on a first start every old parent counts as not chosen and no AI Change exists yet (the table is new in 0.26). "AI set it": `wasParentSetByAI(ingredientId, parentId)` in `repositories/ingredient-ai-changes.ts`, a parent AI Change to that parent not undone; it shares `hasParentChange` with `wasParentUndone`. `askAIAbout` asks it once per food with a parent and passes `filedUnder: { ...parent, byAI }`. No new column.
- A kept parent goes through `parentByAI` with the same id: no change recorded, outcome "parent".
- Tests (`review.test.ts`, describe "a food an earlier AI answer gave its parent"): lean chicken mince that AI filed under kipgehakt keeps it when AI later says "chicken mince"; eiwitpoeder naturel that AI filed under protein keeps it over the category "protein powder". The pre-53 drops stand: peanut butter under butter with AI's "spread", Klop-Fix fish with the category "baking mix".
- Ceilings, not built: AI Changes are swept 30 days after they were made, kept or sure (`sweepAIChanges`), so after that an AI parent counts as one from the words; AI confirming a parent the words gave records no change (`parentByAI` records only a move), so that parent is not "AI's" either.
- Release-notes line and ADR-0037 amendment.
