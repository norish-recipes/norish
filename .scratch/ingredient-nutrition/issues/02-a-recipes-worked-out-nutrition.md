# 02: A recipe's worked-out nutrition

**What to build:** A recipe with no supplied Nutrition Information shows nutrition per serving worked out from its lines, computed when it is read and never stored on the recipe. In this ticket only weight lines (g, kg, oz, lb) count. A pinch, a dash or "to taste" counts as nothing. Every other line is named under the total as "Not counted". A credit line names the datasets the total used. Supplied Nutrition Information always wins and shows as before.

**Blocked by:** 01

**Status:** done, pending gates and review

- [x] "200 g onion, 500 g rice" on a recipe of 4 servings shows the sum divided by 4.
- [x] "Salt to taste" and "a pinch of nutmeg" neither count nor appear under "Not counted".
- [x] A line without an amount, with a unit that does not reach grams, or on an Ingredient with no numbers is named under "Not counted"; the total still shows.
- [x] A recipe with every line uncounted shows no worked-out total.
- [x] A recipe with supplied Nutrition Information shows only that.
- [x] The credit line names only the datasets the total actually used.
- [x] The computation reads the reader's household, so ticket 08's corrections can slot in without a reshape.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented. The arithmetic is `workOutNutrition` in `@norish/shared/lib/recipe-nutrition`, beside the line cost. Tickets 02 and 04 landed together: counted and measured lines reach grams through the piece weight and density as well as weight.
- It is worked out in the browser (`useWorkedOutNutrition`). The server answers each Ingredient's nutrition for the reader's household (`ingredients.nutritionFor`), and the total is computed from the recipe's lines as they are, so editing an amount moves it at once and nothing is stored. The server computes the same total with `workOutRecipeNutrition`, for ticket 12's estimate.
- Only the lines in the recipe's own measurement system count, without `#` headings. A line with no amount whose text starts or ends with a pinch, dash or "to taste" phrase of the units map ("salt to taste") is seasoning, as is a line with one of those units.
- A recipe storing any nutrition value shows only what it stores. The mobile Glance Bar restates a worked-out total's calories, as it restates the stored ones. Each name under "Not counted" opens that Ingredient's panel.
