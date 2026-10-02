# 18: Spoon measures: browser spec, docs and release notes

**What to build:** End-to-end coverage and documentation for tickets 14–17, following `docs/agents/feature-docs.md`. The offline (no AI) browser spec grows to cover three things:
- a spoon line counted through a density fix;
- the asterisk and its list of lines left out, with reasons;
- a corrected teaspoon weight changing one household's total.

The nutrition docs explain spoon weights and the lines-left-out list with retaken screenshots. The 0.25.0 release notes gain the changes.

**Blocked by:** 14, 15, 16, 17

**Status:** done, pending review

- [x] `apps/web/__tests__/e2e/offline/ingredient-nutrition.e2e.ts` covers:
  - "1 tl komijn" counted through cumin's density fix;
  - "salt to taste" listed as seasoning behind the asterisk;
  - a household's corrected teaspoon of cumin changing its total and no other household's.
- [x] `apps/docs/docs/recipes/nutrition.md` and `apps/docs/docs/groceries/ingredients.md` describe:
  - spoon weights and where they come from;
  - the lines-left-out list and its reasons;
  - the panel's spoon row.

  Their screenshots are retaken.
- [x] `apps/docs/docs/release-notes/0.25.0-beta.md` describes:
  - spoon measures counting without AI;
  - every line left out being named;
  - the unit-word fixes ("T" read as a tablespoon, "Stück" as pieces).
- [x] The docs format check and production build pass inside `apps/docs`.
- [x] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-02, implemented.
  - The offline spec's recipe gains "komijn" (1 teaspoon of cumin, seeded with no code, so its numbers are Norish's fix and its teaspoon the density fix) and a cup of flour with no density.
  - The red onions became three, so the borrowed share stays above a tenth. The totals are 729 per serving, 744 with household A's rice and 749 with its 4 g teaspoon of cumin; household B keeps 729.
  - The first test opens the asterisk's list (flour: no spoon weight yet; olive oil for frying: no amount; salt to taste: seasoning), follows the flour, the one link, and sees its panel ask what a cup weighs. A new test reads cumin's teaspoon from USDA, corrects it to 4 g and sees one household's total move. All four tests pass on the offline project.
  - Screenshots were shot off the offline E2E stack with a throwaway spec, since deleted: the card with its list open, cumin's Nutrition panel, the teaspoon correction, and flour's panel asking (`ingredients-nutrition-spoon.png`, new).
  - `ingredients-panel.png` on the Ingredients page predates the catalogue's own redesign and was left as it is.
  - The release notes add an upgrade note: a server with an edited units list keeps it, so it misses the one-owner fixes.
- 2026-10-02, gates: lint, typecheck, `test:run`, `i18n:check`, format and `build` pass, as do the repository tests (`packages/db`, 300). The whole browser suite passes on a fresh build: 147 tests over the ai, offline and realtime projects.
