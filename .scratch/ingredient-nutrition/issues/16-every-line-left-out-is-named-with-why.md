# 16: Every line left out is named, with why

**What to build:** A worked-out total names every line it left out, each with one reason, seasoning included. "Salt to taste" and "a pinch of nutmeg" no longer count silently as nothing. The recipe card puts an asterisk after the calories and "N lines not counted ▸" beneath the numbers, and opens the list in place on click or tap. Lines the language model estimated join that list, marked as estimated by AI. Only lines whose fix is a fact in the Ingredient's panel link to it.

A total now says it is estimated only when the lines that borrowed a fact bring at least 10% of its calories. Today any borrowed fact marks it: a teaspoon of paprika powder borrowing paprika's density marks every dev recipe that shows a total.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `workOutNutrition` (`packages/shared/src/lib/recipe-nutrition.ts`) gives each line left out one reason:
  - seasoning (pinch, dash, to taste);
  - no amount;
  - a measure with no size;
  - no spoon weight;
  - no piece weight;
  - no numbers, which includes a line naming no Ingredient.
- [ ] Seasoning lines are listed, never counted, and never sent to the language model to estimate.
- [ ] The card shows the calories with an asterisk and "6 lines not counted ▸" beneath the numbers. A click or tap opens the list in place, each line with its reason. Nothing shows when every line counted.
- [ ] Lines the language model estimated appear in that list, marked as estimated by AI. Lines that only borrowed are not listed.
- [ ] Lines left out for no spoon weight, no piece weight or no numbers open the Ingredient's panel; the other lines don't link.
- [ ] A total is estimated when the lines that borrowed a fact bring at least 10% of its counted calories, or when any line's share came from the language model.
  - A borrowed teaspoon of paprika in a 2,000 kcal recipe leaves it counted.
  - A cup of flour on a borrowed density marks it.
- [ ] The reasons and labels are translated in every locale.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, from the spoon-measures grill. Mike chose transparency over a short list: every line left out is named, behind the asterisk so a long list doesn't crowd the card. This reverses the earlier rule that a pinch, a dash or "to taste" counts as nothing, unnamed (story 5).
