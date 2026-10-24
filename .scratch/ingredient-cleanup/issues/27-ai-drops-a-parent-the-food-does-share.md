# 27: AI drops a parent the food does share

**What to build:** Found by ticket 12. With AI on, the pass dropped 4 parents on the production copy as sure changes (ticket 23's "no general food"). One drop is right ("Denta tix" from tea). Three are wrong: "chocolate whey" from whey, "Italian herbs" from herb and "chinese 5 spice" from spice. The words gave each a parent that is the general food.

**Why:** AI named a category as the general food: "whey protein powder", "herb seasoning", "spice blend". No food in the catalogue has that name, so the code read it as no general food and dropped the parent (ticket 23).

**Fix (Mike, 2026-10-21):** AI keeps to the facts.

- The prompt asks each food's `parent` (ticket 24) as a plain food a shopper buys, the base food it is made of or sold as: "chocolate whey" is whey, "Italian herbs" is herbs, "rode uien" is onion. Never a category ("spice blend", "dog treats"); null when there is none.
- The question shows the parent the food has now ("Filed under: whey"), so AI judges a real parent instead of making one up.
- The code looks the answer up as today. No check on shared words.

**Blocked by:** 24

**Status:** done

- [ ] "chocolate whey", "Italian herbs" and "chinese 5 spice" keep their parents. (code side tested; the real model's answers are ticket 31's measurement)
- [ ] "Denta tix" still loses tea. (same: ticket 31)
- [ ] All `CONTRIBUTING.md` gates pass. (shared-server tests, typecheck and lint pass; the full repo gates are the orchestrator's run)

2026-10-21, implemented:

- The question appends a `Filed under: <parent name>` section after `Name: <text>` when the food has a parent now (none otherwise). `AskOptions.filedUnder` carries the name; `askAIAbout` reads it with `findCatalogueIngredient(row.parentId)`. Only the reading request gets it, not the second "which of these" question.
- Prompt `ingredient-resolution.txt`: `parent` is the plain food a shopper buys that it is made of or sold as ("chocolate whey" is "whey", "Italian herbs" is "herbs", "rode uien" is "onion"), never a category ("spice blend", "whey protein powder", "dog treats"), null when none; a shown parent is given back when right, another or null when not. The schema's `parent` description says the same.
- The lookup is unchanged: AI's parent found by `findOtherFoodsNamed` (through `findNamed` since the 26 review fix, slips asked) keeps or replaces the parent, one not found drops it (ticket 23).
- The trace field `generalFood` is now `parent` (`ReviewTrace` in shared contracts).
- Tests in `review.test.ts`, "a food whose words filed it under a plain food it does share": the section is sent and whey is kept; a parent AI names that the catalogue has replaces the words' one. A food with no parent is asked about its name alone.
- Release notes: a line on keeping the plain-food parent, and the 0.26 upgrade note on the Ingredient resolution prompt names the `Filed under` section and the new `parent` wording.
