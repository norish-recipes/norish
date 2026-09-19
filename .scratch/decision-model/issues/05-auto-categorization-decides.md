# 05 — Auto-categorization asks a Decision first

Status: ready-for-agent
Blocked by: 04

Spec: `.scratch/decision-model/spec.md`

## What to build

When a Decision Model is configured, auto-categorization asks it four Boolean questions — is this a breakfast, a lunch, a dinner, a snack — instead of asking the language model to write the words. Categories whose probability clears the constant are set. When none clears it, or the Decision Model is not configured or fails, the kind asks the language model exactly as it does today. Nothing about when the kind runs, what it may overwrite, or how the queue reports it changes.

## Notes

Today (`packages/shared-server/src/ai/enrichment/auto-categorizer.ts`): a structured-generation request against a four-value enum, then every returned value goes through the fuse.js matcher in `category-matcher.ts` because models ignore enums. The coordinator's `supplied-data-present` skip and the worker's "an empty list is a retryable failure, not a write" rule (`packages/queue/src/auto-categorization/worker.ts`) stay exactly as they are.

Shape of the conversion, in the same file:

```ts
const CATEGORY_THRESHOLD = 0.6; // a category the model is at least this sure of is set

export async function categorizeRecipe(recipe) {
  if (await isDecisionUseEnabled("autoCategorization")) {
    const decided = await decideCategories(recipe).catch(warnAndFallBack);
    if (decided && decided.length > 0) return decided;
  }
  return categorizeWithLanguageModel(recipe); // the function that exists today, renamed
}
```

`decideCategories` composes a JSON state (`{ title, description, ingredients: [...] }` — structured, since the recipe is structured), asks four Booleans keyed `Breakfast`/`Lunch`/`Dinner`/`Snack` with one-line instructions each ("Is this recipe a breakfast dish?"), and returns the keys whose `probability >= CATEGORY_THRESHOLD`. Four Booleans rather than one Choice because a recipe may be several categories, and the product already stores several.

A `decide` failure of any kind is logged at warn with the feature name and falls through to the language model; it is never the reason the job fails. An answer where nothing clears the threshold is not a failure either — it is the "unclear" case and goes to the language model.

The log line for a Decision-backed run should say which path produced the categories (`path: "decision" | "language-model"`) so a self-hoster can see the cheap path is being taken.

Extraction's own category normalisation (`extraction-normalizer.ts`, the matcher on the free-text `categories[]` the extractor returns) is **not** touched: those are Imported Recipe Data, and the matcher is the right tool for words.

## Acceptance criteria

- [ ] With a Decision Model configured, `categorizeRecipe` issues one `decide` call with four Boolean questions and no `generateStructured` call when at least one category clears the threshold.
- [ ] With nothing clearing the threshold, the language model is asked and its answer is used, matched as today.
- [ ] With the Decision Model unconfigured, disabled, its Auto-categorization use switched off, or throwing any `AIError`, behaviour is byte-for-byte today's: one `generateStructured` call, the matcher, the same result.
- [ ] The threshold is a named constant with a boundary test (0.59 not set, 0.60 set).
- [ ] The worker's empty-list rule and the coordinator's supplied-data skip are unchanged (existing tests still pass untouched).
- [ ] Feature tests mock `decide`, `generateStructured` and `isDecisionUseEnabled` from the runtime and loader, nothing else.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Changing the automatic switch, its default, or the bulk sweep.
- A Choice question. Multi-label is the product's shape.

## Comments

- Filed 2026-09-19 with the spec.
