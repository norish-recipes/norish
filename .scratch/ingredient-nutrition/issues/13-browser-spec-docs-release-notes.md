# 13: Browser spec, docs and release notes

**What to build:** End-to-end coverage and documentation for Ingredient Nutrition, following `docs/agents/feature-docs.md`. A browser spec walks through these on the production-like stack, without AI:
- a recipe's worked-out total
- its "Not counted" list
- an estimated total
- a household correction changing the total for that household only
- a legacy "salt to taste" line landing on salt

The docs gain a page with screenshots, and the 0.25.0 release notes gain the feature.

**Blocked by:** 08, 11, 12

**Status:** done, pending gates and review

- [x] A browser spec covers the walkthrough above and passes in the E2E suite.
- [x] `apps/docs` has an Ingredient Nutrition page with screenshots, including the credits and how corrections work.
- [x] The 0.25.0 release notes describe the feature and the legacy re-check.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- 2026-10-01 implemented. `apps/web/__tests__/e2e/offline/ingredient-nutrition.e2e.ts` seeds its own small catalogue (the stack fetches no taxonomy) and uses its own browser contexts. It restarts the server once, under a forgotten rung version, so the legacy "salt to taste" mint is merged into salt. The whole offline project passes with it (17/17). The offline harness now exposes `databaseUrl`.
- The run found a real bug: CoFID 2021 gives code 13-669 to two foods, the duplicate primary key failed the boot apply, and every instance had no numbers. The build now drops a code its dataset gives twice, and the table schema refuses duplicates.
- Docs: new `apps/docs/docs/recipes/nutrition.md`, with the Ingredients, recipe page and enrichment pages updated. Screenshots were shot off the E2E stack: `recipe-nutrition-worked-out.png`, `ingredients-panel-nutrition.png`, `ingredients-nutrition-correction.png`, and a retaken `ingredients-data-sources.png`. The 0.25.0 release notes gain a Features section, three fixes and an upgrade note.
