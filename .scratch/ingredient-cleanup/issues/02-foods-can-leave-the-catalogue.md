# 02: Foods can leave the catalogue

**What to build:** Deleting a food or a translation that something still uses works instead of being refused:

- recipe lines and groceries (recurring ones too) keep their text and point at no food;
- the food's Pantry Ingredients are deleted, because the Pantry holds only foods;
- the confirm dialog says how many recipe lines, groceries and pantry entries it touches;
- the ✕ on a translation shows even while lines use it.

A nightly scheduled task, beside the existing ones, deletes foods someone's action minted once nothing has named them for 90 days. "Named" means a recipe line, Grocery, recurring grocery or Pantry Ingredient points at the food. The task does this by setting and clearing an "unused since" mark, so no write path has to touch it. A recurring grocery keeps its food alive. Seeded foods are never deleted. Recurring groceries also learn "yearly" ("every year", "jaarlijks" and each language's word), so a yearly purchase keeps its food.

See `CONTEXT.md` (Ingredient) and ADR-0037's second 2026-10-17 amendment.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Deleting a food a recipe line, grocery and Pantry Ingredient use succeeds. The line and grocery keep their text and point at no food, and the Pantry Ingredient is gone.
- [x] Removing a translation a line uses succeeds, and the line points at no food.
- [x] The confirm dialog shows the counts it will unlink. The old "cannot be deleted; merge it instead" copy is gone in every locale.
- [x] An own food unused for 90 days is deleted by the nightly task; one unused for 89 days is not. Using it again clears the mark.
- [x] A seeded food is never deleted by the task.
- [x] A food named only by a recurring grocery is kept.
- [x] "yearly", "every year" and "jaarlijks" parse, compute the next date and format back, with unit words in every locale.
- [x] Browser: the catalogue spec's "one a grocery uses cannot" scenario becomes deleting a food a grocery uses, with the grocery still on the list under its text.
- [x] All `CONTRIBUTING.md` gates pass.

## Comments

2026-10-18, implemented:

- Deleting goes through the foreign keys (migration 0076): a recipe line's and a Grocery's alias and food are set null, and a Pantry Ingredient cascades. Removing a spelling also clears the food kept beside a Grocery's alias. The in-use refusals, their copy in every locale, and the spelling's `inUse` flag are gone.
- The delete dialog reads the existing `uses` query, which now also returns `counts` across the instance, and lists only the non-zero ones. Confirm waits until they are read. "Show where" opens the existing where-used panel, which the removed refusal toast used to open.
- A recipe save, and a grocery added from a recipe line, keep "no food" for an unchanged stored line. Otherwise the next save of the recipe would mint the deleted food again.
- 90 days, not the spec's 30 (Mike, 2026-10-18). The sweep is the scheduled task `ingredient-sweep`. "Own" means no `off_id`, like Clean names. `owner_id` is not used, because deleting a user nulls it. Night 90 deletes what night 0 marked, with half a day of slack for start-time jitter. A line saved onto a food at the instant the sweep deletes it is unlinked; this is marked `ponytail:` in the code.
- A food is not deleted while it has a child, and its mark stays, so it goes the night after its last child does (Mike, 2026-10-18). On the production copy, 77 own foods are named by nothing; 3 of them are parents, and only "zoete aardappel friet" has a child something uses, so the cleanup loses that one food.
- Year words are in every language. The parser also gained German, Polish, Russian, Finnish, Norwegian, Bulgarian and Portuguese (Mike, 2026-10-18); their adverbs ("täglich", "codziennie") are interval hints, as in Ukrainian, so "wöchentlich am Montag" drops the weekday. Spanish gained "a cada", which it reads before Portuguese. Dutch gained "elk" ("elk jaar"). None of the 3,964 texts on the production copy (grocery names, recipe lines, own spellings) reads differently. The repeat panel gained a Yearly option.
- Release notes are left to ticket 09: the delete dialog, the 90-day sweep and yearly groceries.

