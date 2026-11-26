# 09: Leaving takes your recipes, joining merges a household of one

**What to build:**

- **Leaving or being removed:** the person's recipes and cookbooks move to their new household of one, with copies of the household names and foods those recipes use.
- **Joining from a household of one:** it merges into the joined household.

See the spec, "Membership changes".

**Blocked by:** 03, 05, 07

**Status:** ready-for-agent

- [x] **Leave and remove** (one shared path) move the person's recipes and cookbooks to the new household, with their images, videos and share links. Then:
  - their Tags, Cuisines and Categories are matched on the folded name in the new household and created where missing;
  - each household food their lines use is copied into the new household with its name, the spellings those lines use, its icon and any seed parent, and the lines are re-pointed at the copies;
  - nutrition corrections, Aisle Links and store links stay behind.
- [x] **The leave and remove dialogs** (web and mobile) say what goes and what stays.
- [x] **Joining as the last member of a household of one** merges it in:
  - recipes, cookbooks and every household row move to the joined household;
  - Tags, Cuisines and Categories with the same folded name join the household's entry;
  - a spelling both catalogues hold merges the joiner's food into the household's, through the existing merge;
  - Pantry duplicates are dropped;
  - both sets of stores are kept;
  - the empty household is deleted.

  This lifts ticket 01's interim refusal. A member of a larger household leaves first, as today's flow does.

- [x] **Old household's plan:** its entries for the moved recipes show only the title wherever it can no longer see them (ticket 03).
- [x] **Each move is one transaction** followed by a Scope Change.
- [x] **Tests:**
  - leaving under view Household: the leaver keeps their recipes with tags and foods intact, and the household no longer sees them;
  - joining merges "soja" and "ui" into the household's;
  - E2E for leave and join.

## Comments

- Leave/remove (`moveToHouseholdOfOne`, shared by both): after the triggers move recipes and cookbooks, `homeRecipeEntriesTx` gives the new household an entry of each fold its recipes carry of another household (copy keeps name and casing) and re-points the links; instance entries stay. `homeRecipeFoodsTx` copies each foreign own food the lines use (name, flags, `icon` file name, AI estimate; no owner, not "unused"), its parent if seeded, else the copy of an own parent only when the lines use that one too, else none; the spellings the lines use go with it, a household spelling on a seeded food becomes the new household's on that food; lines re-pointed. Icon files are content-addressed and only `deleteUnusedIngredientIcons` removes one, after checking no food names it, so a shared file is safe. Corrections, Aisle/Product Links, store preferences and everything household-owned stay.
- Join (`mergeHouseholdTx` before the household is deleted): `stores` move (sort after the household's; aisles, Store Products and links follow), `groceries`, `recurring_groceries`, `planned_items` move; `pantry_ingredients`, `ingredient_nutrition_corrections`, `ingredient_store_preferences` move, the joiner's row dropped where the household has one for that food (the household's is what its members set and see); `tags`/`cuisines`/`categories` become the household's entry of their fold (made where missing); an own food the household has by name, else by a shared spelling, merges through the merge core (`mergeLockedFoods`, ADR-0037); a spelling both hold gives its lines, groceries and Pantry rows (duplicates dropped) to the household's; junk marks of a shared fold stay the household's (names-a-food marks included); remaining `ingredients`, `ingredient_aliases`, `ingredient_junk_pile`, `ingredient_ai_changes` move; `recipes`/`cookbooks`/`household_users` via the membership. A test enumerates every schema table with `household_id` (17) and checks moved/merged/dropped counts and the old id nowhere.
- AI shares: `rekeyedShares` (shared) + `rekeyNutritionSharesTx` re-key stored keys by food id in one write; used by the leave, the merge core (so every catalogue merge keeps shares now) and the join's spelling re-point. A recipe with two lines of one food, amount and unit where only one moves loses that one share.
- Locks: households (id order), membership, recipe rows (triggers), then the carried list entries and foreign foods then spellings `FOR SHARE` (the household's own of those folds `FOR KEY SHARE`), re-read until nothing new (`lockUntilSettled`: a housemate's merge committing during the wait moved rows onto ones the first read missed; two race tests fail without it). The join retries a unique violation from a housemate's concurrent write. A save resolved before a move commits is refused in its transaction (`StaleLineHouseholdError`) and resolves again. Races 20/20.
- Cost: a leave is ~35 statements, a join ~45 plus ~15 per colliding food; each is set-based on indexed columns, so thousands of recipes and tens of thousands of lines add rows to statements, not statements (not measured).
- Told: the mover's `created` and Scope Change, then `userJoined`/`userLeft`/`memberRemoved` to who stays; those three now reread every query, as `created` does. Dialogs: leave (web and mobile) and kick say recipes and cookbooks go with tags and ingredients, groceries, pantry, plan and stores stay; the join card says the household of one is merged in. A member of a larger household sees no join card until they leave.
- Removed: `HELD_BY_*`, `holdsAnything`, the `holds-things` refusal and its copy in all locales. Not run: the E2E (`ai/leaving-and-joining.e2e.ts`) typechecks and lints.


Review round 1:

1. Fixed: each joiner food has one target (the household's food of its name, else the one holding the first shared spelling) and merges through `mergeLockedFoods`; a shared spelling's rows take the target's spelling (`deleteCatalogueAlias` with `heirsSeenBy`, same fold first) and the household's spelling stays put; the Pantry dedupes after.
2. Fixed: the estimate and flag move where the target has none (never onto a seeded food); AI Changes of every kind follow the target, all but merges stranded, and so is any naming a removed spelling or food; a correction's empty groups (numbers, piece weight, density) take the joiner's; a preference moves where the household has none.
3. Fixed: a copy whose own parent stays behind goes under its nearest seeded ancestor.
4. Fixed: `insertLinksTx` and `writeRecipeLineFoodsTx` refuse an entry or spelling outside the recipe's household; recipe writes hold its household `FOR KEY SHARE` before the recipe row (`lockRecipeHouseholdsTx`); re-resolution rereads the lines' households each try; a stale Cuisine id takes the household's entry of its fold, else refused; Undo's restored food skips lines that left. Writers under the tree lock check without that lock, which would invert the join's order.
5. Fixed: the join locks the tree, then sources and targets, rereading until settled; lists, catalogue, then rows.
6. Kept: inserts wait on the households lock, but a person's food rename takes neither it nor the tree lock, and the name index is an expression no row lock covers. Three attempts, then the `busy` refusal (copy in every locale).
7. Fixed: `pickedByKey` aggregates once (20,000 keys: 920 to 63 ms); `householdRows`/`assertOwnReferences` bind one array. A join with 300 colliding foods, each with a line and a shared spelling, takes ~1.6 s on the test container (~24 statements per merge, ~7 per shared spelling); not batched.
8. Fixed: shares that meet add up; the estimate's save rekeys by the lines' foods at save, under the household lock.
9. Verified and fixed: a removal skips an entry that is the account's plan again.
10. Fixed: the join races merge the target away and rename into the joiner's name; added the four named cases. Races 20/20, moves 20/20.
11. Fixed: `sameFoodName`, `foldedIn`; the third lines-and-shares copy went with `giveSpellingRowsTo`.
12. Fixed: `foodsNamedIn` (where a food lands by name) for leave and join; `takeEntriesOfFoldsTx` for lists.
13. Fixed: `household-catalogue.ts`; `carry*` for a leave, `mergeHousehold*` for a join; `FoodTargets`.
14. Fixed: `readerScopedKeys` plus lists, ingredients, stores and Pantry.

- Rejected: a joiner's store preference dropped where the household has one; same-named stores both kept.

Review round 2:

1. Fixed: `writeConvertedCopy` holds the household before the recipe row. Checked: every write of a recipe's lines or list links takes the household first (update, categories, steps and lines, enrichment, Cuisines, tags); create has its new row only; catalogue and list merges keep their own order.
2. Fixed: where several joiner foods merge into one target, the household's values win, then the joiner's on that food, then its foods oldest first: each correction group, the estimate and the flag.
3. Fixed: a share added up after a move is `combined` and counted once; a save keys each share by its own line's foods.
4. Fixed: a stranded change is sure (never open, never pending) and AI's doubt it held lifts unless another change is open.
5. Fixed: a Cuisine id outside the household and instance takes the household's entry of its fold, else the instance's, else is dropped; so is an id gone.
6. Fixed: `pickedByKey` is `jsonb_object` over two arrays (20,000 keys: 26 ms); `lockIngredients` binds one array.
7. Fixed: the rename race holds the real rename uncommitted, so the join retries and merges; added a seeded target, a joiner parent and child both colliding, and several foods into one target; the Library test names seeded foods again. Races 20/20, moves 20/20.

- Rejected: stranding a moved change whose Undo might still apply; parent chains longer than the walk's limit.
