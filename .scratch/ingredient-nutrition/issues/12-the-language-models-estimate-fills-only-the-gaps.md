# 12: The language model's estimate fills only the gaps

**What to build:** When AI estimates a recipe's nutrition, the estimator is given the lines Ingredient Nutrition counts, with their numbers, and estimates only the lines left uncounted, as CONTEXT's Nutrition Information says. Recipes with supplied Nutrition Information are untouched, and nothing changes on an instance without AI.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The estimate request carries the counted lines' numbers as given facts, appended as a section to the existing prompt, never a finished prompt string (ADR-0016).
- [ ] A recipe whose every line counts gets no AI estimate run.
- [ ] Supplied Nutrition Information still suppresses the estimate.
- [ ] All gates pass: `pnpm lint`, `pnpm test:run`, `pnpm i18n:check` and `pnpm build`.

## Comments

- Open while implementing: whether a stored AI estimate is still worth storing once the worked-out total is computed on read for the household. Decide with Mike before writing it.
