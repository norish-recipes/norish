# 04: Filter by Ingredient, kinds included

**What to build:** `library.list` accepts Ingredient ids and keeps recipes with a line naming that Ingredient or any descendant through Parent Ingredient, never an ancestor. Mobile shows an Ingredient chip (with its Ingredient Icon) in Search's results.

**Blocked by:** 03

**Status:** ready-for-agent

- [x] Server: the filter joins `recipe_ingredients → recipe_ingredient_foods → ingredient_aliases` as `pantryCoverageSql` does (`packages/db/src/repositories/pantry-coverage.ts`), with a recursive CTE walking *down* `ingredients.parent_id` (nothing walks down today; the existing CTEs walk up). The All/Any `filterMode` covers Tags and Ingredients together; Categories stay Any.
- [x] Repository tests: descendants match, ancestors don't, All vs Any with a tag, an Ingredient with no recipes returns none.
- [x] With no search text but an Ingredient filter, the match line (03) is the line that satisfied it ("Ingredient: 4 chicken thighs").
- [x] Mobile: Search's store holds Ingredient filters; their chips show the Ingredient name and icon (hidden when Hidden Items hides ingredient icons) and × removes them; the Filters sheet's badge counts them.
- [x] Gates green.

## Comments

Implementation (2026-11-20):
- Input is `ingredientIds` (uuid array, max 20) on `library.list` only; left out of the request unless set, so web and the Recipes tab send nothing new. Each id is an EXISTS over `recipe_ingredients → recipe_ingredient_foods → ingredient_aliases` against a down-walking CTE (`ingredient-kinds.ts`, depth-capped so a cycle ends). All = the tag count clause AND one EXISTS per id; Any = those OR'd; Categories unchanged. An Ingredient filter drops cookbooks, like the other recipe-only filters.
- Store: `ingredients: {id, name}[]` on the canonical filters (not persisted), `addIngredient` (idempotent) in the shared store; no icon is kept, the chip reads it by id from the Ingredient icon cache (`useIngredientIcons` once per row), so the suggestions row that already read it adds no fetch. Chip kind `ingredient` in `search-chips.ts` (key = id); the badge and the results state already derive from chips.
- Ingredient-only match: `recipeIngredientMatches` reuses the ingredient-line select of the text match (`ingredientLineSql`: heading rule, one measurement system, first by order), with the filter's kinds as its condition; the text's match still wins; computed only for the page.
- Not done: no UI adds an Ingredient yet (ticket 05), and the chip has not been seen on a device. Also ran `pnpm format`, which reflowed two lines of the match commit.
