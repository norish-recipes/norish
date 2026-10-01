# Legacy recipe lines on flagged mints

Notes from a 2026-10-01 sparring session, written as input for `/grill-with-docs`. Nothing here is decided.

## The problem

`research-coverage.md` found that 40 of the 57 recipe lines in the dev database point at Ingredients Norish minted itself, with no `off_id` and almost no parent. Instances with recipes from before the catalogue seed will look like this, and those lines get no Ingredient Nutrition however good the source is.

### Why such lines end up as flagged mints

- The import parser (`packages/api/src/parser/parsers/ingredients.ts`, via `parseIngredientWithDefaults`) takes off the amount and unit. It hands the rest to the resolver as written, so "salt to taste", "a few shakes of soy sauce" and "sweet chilli sauce to serve" arrive whole.
- The resolver's second rung (`packages/shared-server/src/ingredients/resolver.ts`) strips only what follows a comma or sits in brackets, so "salt to taste" never matches "salt".
- With no AI, rung 4 mints the text flagged. The startup backfill (`packages/api/src/startup/backfill-ingredient-aliases.ts`) runs with `ai: false`, so an instance's whole history took this path.

## Two problems, not one

1. **Nutrition.** Lines without an amount ("to taste", "to serve") cannot become grams even when resolved perfectly. Their right treatment is to be left out of the recipe total, with the total marked estimated. The lines that cost macros are those with an amount stuck on a flagged mint.
2. **Identity** (groceries, pantry, prices). All of these lines matter here.

## Proposal (unmeasured)

1. **Filler-phrase stripping** as a deterministic rung before the preparation-stripped match. It would use a per-language list of serving phrases ("to taste", "to serve", "for garnish", "optional", "naar smaak", "nach Geschmack") and leading vague amounts ("a pinch of", "a few shakes of", "a splash of", "a handful of"). It would live in the shared spelling-keys module, so client and server agree (ticket 15).
2. **Contained-alias fallback:** take the longest seeded alias that appears in the text as whole words. Longest-wins keeps "peanut butter" whole. The risk is "egg noodles" landing on "egg" when the seed has no "egg noodles", so such a match links flagged.
3. **Re-resolve flagged mints:** a pass over Ingredients that are flagged, have no `off_id` and no person's decision. It merges where the new rungs resolve, re-runs when the rungs change, and leaves alone anything a person marked distinct. It has the same shape as ADR-0038's one-off pass.
4. **AI stays optional on top.** Whatever no rung resolves stays in the Ingredients page's flagged list.

## Open decisions

- Does a contained-alias match link (flagged) or only suggest?
- Is the filler list per language, or language-free?
- Is the re-resolve pass one-off per rung version, or recurring?
- How should unquantified lines show in a recipe total?
- Measure first: what share of flagged mints do rungs 1 and 2 resolve? The dev DB is too small; options are a real instance's dump or the Ahn et al. 2011 corpus used in `research-coverage.md`.
