# 13: Browser spec, docs and release notes

**What to build:** End-to-end coverage and documentation for Ingredient Nutrition, following `docs/agents/feature-docs.md`. A browser spec walks through these on the production-like stack, without AI:
- a recipe's worked-out total
- its "Not counted" list
- an estimated total
- a household correction changing the total for that household only
- a legacy "salt to taste" line landing on salt

The docs gain a page with screenshots, and the 0.25.0 release notes gain the feature.

**Blocked by:** 08, 11, 12

**Status:** ready-for-agent

- [ ] A browser spec covers the walkthrough above and passes in the E2E suite.
- [ ] `apps/docs` has an Ingredient Nutrition page with screenshots, including the credits and how corrections work.
- [ ] The 0.25.0 release notes describe the feature and the legacy re-check.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.
