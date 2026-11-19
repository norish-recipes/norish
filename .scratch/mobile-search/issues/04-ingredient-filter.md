# 04: Filter by Ingredient, kinds included

**What to build:** `library.list` accepts Ingredient ids and keeps recipes with a line naming that Ingredient or any descendant through Parent Ingredient, never an ancestor. Mobile shows an Ingredient chip (with its Ingredient Icon) in Search's results.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Server: the filter joins `recipe_ingredients → recipe_ingredient_foods → ingredient_aliases` as `pantryCoverageSql` does (`packages/db/src/repositories/pantry-coverage.ts`), with a recursive CTE walking *down* `ingredients.parent_id` (nothing walks down today; the existing CTEs walk up). The All/Any `filterMode` covers Tags and Ingredients together; Categories stay Any.
- [ ] Repository tests: descendants match, ancestors don't, All vs Any with a tag, an Ingredient with no recipes returns none.
- [ ] With no search text but an Ingredient filter, the match line (03) is the line that satisfied it ("Ingredient: 4 chicken thighs").
- [ ] Mobile: Search's store holds Ingredient filters; their chips show the Ingredient name and icon (hidden when Hidden Items hides ingredient icons) and × removes them; the Filters sheet's badge counts them.
- [ ] Gates green.

## Comments
