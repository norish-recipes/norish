# 03 AI fills missing nutrition and conversions on new foods

Status: ready-for-agent
Blocked by: 01

Spec: Solution 1 (fills), 6

## What

- A new administrator-editable Prompt for a food's missing facts, called through `ai/runtime/runtime.ts` (ADR-0015/0016). One call per food asks only for what is missing and enabled: macros per 100 g (`nutrition`), density and piece weight (`conversions`). Lives under `ai/enrichment/` as a catalogue enrichment.
- The answer is stored for the whole instance as its own source. In `ingredient-nutrition.ts` it ranks below household correction, Norish fixes and the datasets, above parent lending, and counts as borrowed for the recipe total's "estimated". The food's nutrition source reads "Estimated by AI" wherever the source is shown today.
- After a mint, with `nutrition`/`conversions` on: after the clean-up job when `cleanUp` is on (for the food it left), otherwise straight after the mint. A food that already has its own value for a field is never asked for it.
- Not an AI Change; no Decision Model check.

## Acceptance

- Ranking tests: correction > fixes > dataset > AI > parent; AI value counts as borrowed.
- Gating tests per option, and the clean-up-first ordering.
- A food with dataset numbers is never sent to AI.

## Comments

- 2026-10-24, implemented in 78452b9cf. Estimates live in a new table `ingredient_nutrition_estimates` (migration 0082) with source kind `ai`. The Prompt is `ingredient-nutrition` (field `ingredientNutrition`), so there are now seventeen Prompts. AI may answer that a food is not counted in pieces (`pieceless`). Like a piece fix, that leaves the food with no piece weight, borrows none, and closes the gap. A gap means no fact of the food's own (dataset, fix, earlier estimate) and no household's correction for that fact; what a parent lends does not count. The fill has its own queue, `ingredient-fill`, one job with a `filling-gaps` step per food, as many at once as `INGREDIENT_REVIEW_CONCURRENCY`. For ticket 04: `addIngredientFillJob(ids, { nutrition, conversions })` queues it and returns the count, and `listFoodsWithGaps` gives the counts. Only listed foods are filled, so grocery-only foods are left out. Icons stay on their own queue. After a mint's clean-up pass, the fills go to the same foods that get icons: the ones AI answered for that are still there (`queueIconAndFills`). An administrator's Clean up catalogue run queues neither.
