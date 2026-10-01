# 02: A recipe's worked-out nutrition

**What to build:** A recipe with no supplied Nutrition Information shows nutrition per serving worked out from its lines, computed when it is read and never stored on the recipe. In this ticket only weight lines (g, kg, oz, lb) count. A pinch, a dash or "to taste" counts as nothing. Every other line is named under the total as "Not counted". A credit line names the datasets the total used. Supplied Nutrition Information always wins and shows as before.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] "200 g onion, 500 g rice" on a recipe of 4 servings shows the sum divided by 4.
- [ ] "Salt to taste" and "a pinch of nutmeg" neither count nor appear under "Not counted".
- [ ] A line without an amount, with a unit that does not reach grams, or on an Ingredient with no numbers is named under "Not counted"; the total still shows.
- [ ] A recipe with every line uncounted shows no worked-out total.
- [ ] A recipe with supplied Nutrition Information shows only that.
- [ ] The credit line names only the datasets the total actually used.
- [ ] The computation reads the reader's household, so ticket 08's corrections can slot in without a reshape.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
