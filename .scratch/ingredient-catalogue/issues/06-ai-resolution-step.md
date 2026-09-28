# 06: AI resolution step

**What to build:** Add rung 3 of the resolution order. When no alias matches, a Decision under a new Decision Use, _ingredient resolution_, is asked about the text. Its state is the text, and its candidates are the Ingredients whose aliases share a word with it. It answers _match X_, _new_ or _new, child of X_; the _child of_ answer is acted on in 09 and treated as _new_ until then. A Clear Case above a named threshold constant is acted on: a sure match adds the text as an alias of X, so the next occurrence matches exactly. Below the threshold, or when the Decision Model is unconfigured or switched off for this use, a language-model request under a new administrator-editable Prompt answers the same question. An Ingredient minted after an unsure answer, or without AI, is flagged.

**Blocked by:** 01

**Status:** done

- [x] The _ingredient resolution_ Decision Use exists in configuration and follows the global AI switch.
- [x] A new Prompt with a shipped default is appended to per ADR-0016, and is editable in the admin prompt settings.
- [x] The threshold is a named constant with a test at its boundary.
- [x] Tests mock `decide` as the one AI seam, and mock the runtime for the language-model path. They cover a sure match, an unsure answer, no AI, and a Decision failure falling back to the language model.
- [x] An import never fails because resolution's AI failed: it falls through to a flagged mint.

## Comments

- Rung 3 lives in `packages/shared-server/src/ai/resolution/ingredient-resolution.ts`; `RESOLUTION_THRESHOLD` is 0.8, higher than grocery linking's 0.5, because a wrong match silently lends one food's links to another while a wrong mint is one merge.
- "Shares a word" is read as "has a word starting with the same four letters", so "onions" finds "onion" and "tomatoes" finds "tomato"; exact word sharing would miss every plural. Each word start reads its own 100 shortest aliases and the candidates take turns across the words, so "red" filling the catalogue cannot crowd "onio" out of "red onions". The search is a `LIKE` scan over alias folds with no index; revisit once the seed (10) has filled the table.
- A text that has no candidates at all is asked nothing and minted **flagged** (review: step 3 did not really run, and a translation sharing no letters, "ui" for "onion", is exactly what only a person catches on an instance without a seed).
- Rung 3 has a time budget, `RESOLUTION_BUDGET_MS` (8 s) per name: it runs inside a person's grocery add, and a failing provider retries three times. Past the budget the mint is flagged and the late answer ignored.
- The language model says itself whether it is sure (`sure` in its answer). An unsure "same" mints a flagged food rather than joining one; an unsure "new" or "kind-of" is a flagged mint.
- Texts in one call that resolve alike (same bare fold) are asked once, and at most four questions run at a time.
- The upgrade backfill resolves with `{ ai: false }`: it walks an instance's whole history at boot.
- 2026-09-28: asking AI about a flagged food from the page was doing nothing for the names that most need it. Probed against the dev catalogue (5,670 seeded foods): brand names ("Unox Knaks") and translations sharing no letters ("ui") find no word-start candidate, so `askWhatFoodThisIs` returned `unknown-food` without asking anything — the same rung-3 outcome that flagged them. The review now asks with `thorough: true` (`AskOptions`): with no candidates the language model is still asked, its answer carries `englishName` (the plain food the name is), and when the first answer did not place the name, the foods that English name finds are put to the question a second time (`askTwice`). Imports keep the old behaviour; a shopper is waiting there. The review's budget is `REVIEW_BUDGET_MS` (30 s) since two model calls may run. Verified live: "uitjes" merges into onion via the second look, "Danio Romige kwark vanille" files under Quark, "Unox Knaks" gets a real distinct verdict.
- Review 2026-09-28, accepted as they are: only the language model names the food, so a Decision that is sure among the name's own word-start candidates gets no second look (its candidates did share a word, and its bar is 0.8); and the budget ignores a late answer rather than aborting it, as rung 3 always has — a second model call past 30 s finishes for nothing. Fixed from the same review: an unsure "kind of" now gets the second look; between two unsure answers the first stands (it saw the name's own candidates); a parent AI named that is gone or would close a cycle re-flags as `food-gone` like a merge target that is gone, instead of clearing the flag.
