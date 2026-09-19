# 06 — Allergy detection asks a Decision first

Status: ready-for-agent
Blocked by: 04

Spec: `.scratch/decision-model/spec.md`

## What to build

When a Decision Model is configured, allergy detection asks one Boolean per household allergen — does this recipe contain X — in a single request, and tags the recipe from the answers. This is the one enrichment kind whose output matters for someone's health, so the rule is deliberately two-sided: an allergen the model is clearly sure about is tagged, one it is clearly sure is absent is not, and a recipe with any allergen in the doubtful band is handed whole to the language model as today. When the Decision Model is not configured or fails, the language model path runs unchanged.

## Notes

Today (`packages/shared-server/src/ai/enrichment/allergy-detector.ts`): the household's allergen list is appended as a Prompt Section, a free-text array comes back, and the code filters it back down to the list case-insensitively. There is no measure of certainty for the one safety-relevant output in the product. The list is already data (`allergiesToDetect: string[]`), so nothing needs to move for this to be a set of Boolean questions.

Two constants, both named beside the questions:

```ts
/** At or above: the allergen is present; tag it. */
const PRESENT_THRESHOLD = 0.7;
/** At or below: the allergen is absent; do not tag it. */
const ABSENT_THRESHOLD = 0.15;
// Between the two for any allergen: the whole recipe goes to the language model.
```

The band is asymmetric on purpose — the cost of a missed allergen is not the cost of a spurious tag — and both numbers are a starting point to be tuned against ticket 04's measurements, not truths. Record what was tried in the comments.

State is the JSON recipe (`{ title, description, ingredients }`). Questions are keyed by allergen name as stored, with instructions in the shape "Does this recipe contain <allergen>, in any ingredient, including as a component of a prepared ingredient?" — the same rule the current Prompt states. The existing short-circuits stay: an empty allergen list is an answer (`[]`), no ingredients throws.

Because the whole recipe falls back on one doubtful allergen, the language-model path is unchanged and needs no per-allergen merge. Keep it that way; a partial merge is where a missed allergen would come from.

The log line names the path and, on the Decision path, the count of allergens tagged and the count in the doubtful band.

## Acceptance criteria

- [ ] With a Decision Model configured and every allergen outside the doubtful band, one `decide` call with N Boolean questions and no `generateStructured` call; the tagged set is exactly the allergens at or above `PRESENT_THRESHOLD`.
- [ ] With any allergen inside the band, the language model is asked and its answer is used, filtered as today; the Decision's answers are not merged in.
- [ ] With the Decision Model unconfigured, disabled, or throwing any `AIError`, behaviour is today's.
- [ ] Boundary tests on both constants.
- [ ] The empty-list and no-ingredient short-circuits are unchanged.
- [ ] The coordinator's `no-household-allergies` skip and the automatic switch are unchanged.
- [ ] A test with a 40-allergen household proves the request is accepted or documents the limit found in ticket 04 and chunks accordingly.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Changing the allergy tag vocabulary or how tags are appended (never removed).
- Exposing the thresholds.

## Comments

- Filed 2026-09-19 with the spec.
