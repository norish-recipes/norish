# 18: Spoon measures: browser spec, docs and release notes

**What to build:** End-to-end coverage and documentation for tickets 14–17, following `docs/agents/feature-docs.md`. The offline (no AI) browser spec grows to cover three things:
- a spoon line counted through a density fix;
- the asterisk and its list of lines left out, with reasons;
- a corrected teaspoon weight changing one household's total.

The nutrition docs explain spoon weights and the lines-left-out list with retaken screenshots. The 0.25.0 release notes gain the changes.

**Blocked by:** 14, 15, 16, 17

**Status:** ready-for-agent

- [ ] `apps/web/__tests__/e2e/offline/ingredient-nutrition.e2e.ts` covers:
  - "1 tl komijn" counted through cumin's density fix;
  - "salt to taste" listed as seasoning behind the asterisk;
  - a household's corrected teaspoon of cumin changing its total and no other household's.
- [ ] `apps/docs/docs/recipes/nutrition.md` and `apps/docs/docs/groceries/ingredients.md` describe:
  - spoon weights and where they come from;
  - the lines-left-out list and its reasons;
  - the panel's spoon row.

  Their screenshots are retaken.
- [ ] `apps/docs/docs/release-notes/0.25.0-beta.md` describes:
  - spoon measures counting without AI;
  - every line left out being named;
  - the unit-word fixes ("T" read as a tablespoon, "Stück" as pieces).
- [ ] The docs format check and production build pass inside `apps/docs`.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
