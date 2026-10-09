# 08: Household corrections

**What to build:** Any household member can correct any Ingredient's numbers, piece weight or density from its panel on the Ingredients page, seeded or not, with no edit policy in the way. A correction is either a dataset food picked by searching in the dataset's own words ("Milk, semi-skimmed, UHT"), or label numbers per 100 g. It is kept apart from the dataset numbers, keyed by the member who made it and read by everyone in their household, the most recent winning. Another household never sees it. It is step 1 of the lookup order, so it outranks the fix list. A child that borrows from a corrected parent borrows the correction. The names under a recipe's "Not counted" open that panel.

**Blocked by:** 03, 04

**Status:** done, pending gates and review

- [x] A member of household A sets milk to semi-skimmed; A's recipe totals change and household B's do not.
- [x] Two members of one household correct the same Ingredient; the later correction holds for both.
- [x] A correction by label numbers marks nothing estimated; the panel shows it as the household's own.
- [x] A correction can be removed, returning to the dataset's numbers.
- [x] Rebuilding or re-applying the source table leaves corrections untouched.
- [x] Other members of the household see a correction without reloading.
- [x] The catalogue export never includes corrections.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented. The table is `ingredient_nutrition_corrections` (one row per member and Ingredient). The household reads its members' most recent row, and Save writes the member's own row as the new most recent. Remove deletes every member's row for that Ingredient, so a housemate's older correction never resurfaces.
- A merge moves corrections the way it moves store preferences: to the target, where that member has none there yet. The seed never removes a dropped Ingredient that has a correction.
- `ingredients.correctNutrition`, `removeNutritionCorrection` and `nutritionFoods` (search by every word, in the dataset's own words). `ingredients.onCorrected` is a household-scoped realtime event; the client refetches the nutrition reads, the same as for `changed`.
- The "Not counted" link to the panel arrives with ticket 02's card: `/settings?tab=ingredients&ingredient=<id>` now opens that food's panel.
