# 08: Another household's recipe reads through your catalogue

**What to build:** At view Everyone, a reader can use another household's recipe. Its lines are then read through the reader's own catalogue:

- adding it to groceries resolves each line's text in the reader's household;
- the Pantry covers it by the reader's foods;
- the nutrition worked out for the reader's household uses the reader's foods and corrections.

The recipe itself is never changed. See the spec, "Ingredient catalogue".

**Blocked by:** 07

**Status:** ready-for-agent

- [x] **Recipe to groceries:** the add-to-groceries path for a recipe outside the reader's household resolves each line's text through the reader's household's resolver, instead of copying the line's food.
- [x] **Pantry coverage** of a foreign recipe's lines resolves them in the reader's household before matching.
- [x] **Ingredient Nutrition** for a foreign recipe is computed per line from the reader household's resolution. The recipe's own Nutrition Information still takes precedence (`packages/db/src/repositories/ingredient-nutrition.ts`).
- [x] **Display:** a foreign recipe's lines still show its own foods and icons. Only _using_ the recipe reads through your catalogue.
- [x] **Tests:** B adds A's recipe to groceries and gets B's foods (seed foods shared, A's own foods resolved again or minted in B). B's pantry covers A's "ui" line with B's "ui". E2E.

## Comments

- Predicate: a line is read through the reader's catalogue when any spelling or food it names is another household's (`outsideCatalogue` in `household-scope.ts`, used only by `findLinesOutsideCatalogue` in `repositories/line-readings.ts`); the seed is shared, so a seeded food keeps; a leaver's own recipe on the old household's foods reads the same way. `readLinesThrough` (shared-server) is the one entry: groceries (`keptFoods` keeps no such line), Library and cookbook coverage, REST nutrition and `recipes.lineReadings` (view-gated, for the client's add sheet and worked-out nutrition, web and mobile).
- Reads: the resolver's `"read"` mode (`readLineFoods`) is rungs 1-2, words and comma lists over the household's spellings and the seed's: no slip, no mint, no write, no queue. Only adding to groceries resolves with minting, in the reader's household. A line read as no food counts as a line not covered, and nutrition lists it as left out (`no-numbers`). The recipe is never written.
- Display: `ingredients.icons({ ids, recipeId })` also answers the foods that recipe's lines name when the reader may view it; every by-id read (`get`, `names`, `nutritionFor`, `icons` without the recipe) still answers nothing for another household's food. Recipe pages show no food names by id (joined lines' names come with the recipe), so `names` is unchanged.
- Cost: a pantry-filtered Library or cookbook page adds one query for every visible line outside the catalogue, one alias read for all their texts (array parameter), one names read, then binds the readings as arrays in the coverage SQL (looked up by `array_position`, so quadratic in foreign lines inside Postgres; fine for a household server, cache per household if that grows). Without the filter nothing is added.
- Deviations: no slips in a read, so a text that is only a slip of a reader's food reads as uncovered while adding it to groceries joins that food (and coverage agrees once that spelling exists); a read-through line loses the AI's stored per-line share, whose key carries the food id; Pantry suggestions are unchanged.
- For ticket 09: once a leaver's lines are re-homed they drop out of `findLinesOutsideCatalogue` and read as stored; nothing else needs changing. Not done: the E2E spec (`ai/foreign-recipe-read-through.e2e.ts`) typechecks and lints but was not run.
