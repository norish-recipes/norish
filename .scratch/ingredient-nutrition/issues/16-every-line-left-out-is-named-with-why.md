# 16: Every line left out is named, with why

**What to build:** A worked-out total names every line it left out, each with one reason, seasoning included. "Salt to taste" and "a pinch of nutmeg" no longer count silently as nothing. The recipe card puts an asterisk after the calories and "N lines not counted ▸" beneath the numbers, and opens the list in place on click or tap. Lines the language model estimated join that list, marked as estimated by AI. Only lines whose fix is a fact in the Ingredient's panel link to it.

A total now says it is estimated only when the lines that borrowed a fact bring at least 10% of its calories. Today any borrowed fact marks it: a teaspoon of paprika powder borrowing paprika's density marks every dev recipe that shows a total.

**Blocked by:** None (can start immediately)

**Status:** done, pending review

- [x] `workOutNutrition` (`packages/shared/src/lib/recipe-nutrition.ts`) gives each line left out one reason:
  - seasoning (pinch, dash, to taste);
  - no amount;
  - a measure with no size;
  - no spoon weight;
  - no piece weight;
  - no numbers, which includes a line naming no Ingredient.
- [x] Seasoning lines are listed, never counted, and never sent to the language model to estimate.
- [x] The card shows the calories with an asterisk and "6 lines not counted ▸" beneath the numbers. A click or tap opens the list in place, each line with its reason. Nothing shows when every line counted.
- [x] Lines the language model estimated appear in that list, marked as estimated by AI. Lines that only borrowed are not listed.
- [x] Lines left out for no spoon weight, no piece weight or no numbers open the Ingredient's panel; the other lines don't link.
- [x] A total is estimated when the lines that borrowed a fact bring at least 10% of its counted calories, or when any line's share came from the language model.
  - A borrowed teaspoon of paprika in a 2,000 kcal recipe leaves it counted.
  - A cup of flour on a borrowed density marks it.
- [x] The reasons and labels are translated in every locale.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, from the spoon-measures grill. Mike chose transparency over a short list: every line left out is named, behind the asterisk so a long list doesn't crowd the card. This reverses the earlier rule that a pinch, a dash or "to taste" counts as nothing, unnamed (story 5).
- 2026-10-02, implemented. `WorkedOutNutrition` now has one `leftOut` list in the recipe's order, each line with its `reason` and whether the language model's share stands in for it (`estimatedByAI`), in place of `uncounted` and `estimatedByAI`.
  - A line gets the first thing that stopped it: seasoning; then its amount; then its measure (`no-size`: a can, a handful, any unit with no size); then its food's numbers (`no-numbers`, also for no food at all); then the weight its measure goes through (`no-spoon-weight`, `no-piece-weight`). So "a cup of brandy" says no numbers, not no spoon weight.
  - `PANEL_REASONS` (no numbers, no spoon weight, no piece weight) decides which names open the food's panel, AI-estimated lines included, by the reason they were left out for.
  - The estimate's shares never apply to a seasoning line, and the worker sends every line left out except seasoning; a recipe whose only lines left out are seasoning asks nothing.
  - The asterisk is `NutritionBody`'s `marked`, after the calories in the ring or the calories row. The toggle repeats it ("* 3 lines not counted ▸") and opens the list in place, like the groceries' done row; the old "Not counted:" and "Estimated by AI:" lines are gone, and "estimated by AI" now marks a line in the list.
  - The browser spec follows: three red onions, so the borrowed share stays above a tenth and the total stays estimated (725 per serving, 740 corrected), and a cup of flour with no density, the one line whose name opens its panel.
- 2026-10-02, review: a generous pinch and a knife tip ("1 Msp. Muskat") are seasoning too, so they are listed as such and never sent to the language model; before, they read as a measure with no size and were estimated.
