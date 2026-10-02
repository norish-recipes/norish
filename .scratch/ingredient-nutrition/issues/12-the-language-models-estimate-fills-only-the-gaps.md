# 12: The language model's estimate fills only the gaps

**What to build:** When AI estimates a recipe's nutrition, the estimator is given the lines Ingredient Nutrition counts, with their numbers, and estimates only the lines left uncounted, as CONTEXT's Nutrition Information says. Recipes with supplied Nutrition Information are untouched, and nothing changes on an instance without AI.

**Blocked by:** 02

**Status:** done, pending gates and review

- [x] The estimate request carries the counted lines' numbers as given facts, appended as a section to the existing prompt, never a finished prompt string (ADR-0016).
- [x] A recipe whose every line counts gets no AI estimate run.
- [x] Supplied Nutrition Information still suppresses the estimate.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- Open while implementing: whether a stored AI estimate is still worth storing once the worked-out total is computed on read for the household. Decide with Mike before writing it.
- 2026-10-01, decided with Mike: the stored estimate is the **gap share, stored apart**. The model returns only the uncounted lines' per-serving share, which is kept in `recipe_nutrition_estimates` (migration `0067`) with the lines it covered (`lineKey`: food or text, amount, unit), never in the recipe's nutrition columns. On read, the household's worked-out total plus that share is the total, marked estimated, with those lines named "Estimated by AI". The share is ignored once the uncounted lines differ from the ones it covered.
- Implemented. The worker works the recipe out on the server with the datasets' numbers and no household's correction (`workOutRecipeNutrition`, `NO_HOUSEHOLD`), which is what most readers see. It passes the counted lines, with their whole-line numbers, as an appended `Already counted:` section, and fills the existing `{{ingredients}}` placeholder with only the uncounted lines. A recipe whose every line counts asks nothing and drops any earlier share. A recipe that supplies Nutrition Information of its own is estimated as a whole, into its own group, as before.
- The share travels on the full recipe (`nutritionEstimate`), so the runner's existing "recipe updated" publish brings it to open pages. Archives build on the insert schema, so it never travels in one.
- 2026-10-01, review: one lump share had to match the household's uncounted lines exactly, so a household whose correction made one gap line countable lost the whole estimate. Now the model answers per numbered line (`estimateNutritionGap`, `nutritionGapEstimationSchema`), the table keeps one `{key, calories, fat, carbs, protein}` per line (migration `0068` drops the lump columns and the rows written in the old shape), and `workOutNutrition` adds the share of each line still left out and lists the rest. An answer that skips, doubles or invents a line number fails the run for a retry.
