# 08 — Recipe Provenance settles the country and Cuisines by Decision, and writes the note around them

Status: resolved
Blocked by: 04, 05

Spec: `.scratch/decision-model/spec.md`
Decision records: ADR-0012 (Cuisines are curated), ADR-0018 (automatic provenance fills the group's gaps)

## What to build

Under the `existing` cuisine strategy, and when a Decision Model is configured with its Recipe Provenance use on, Recipe Provenance asks a Decision first: a Choice over ISO-3166-1 alpha-2 country codes and one Boolean per Cuisine in the administrator's vocabulary. A clear country and its clear Cuisines become **settled slots**, and the language model is then asked to write the region and the note around them — the exact shape ADR-0018's gap-fill already gives Supplied Recipe Data. When the country is unclear, the strategy is `extend`, or there is no Decision Model, the whole group is inferred by the language model as today.

## Decided

The maintainer confirmed this as a good fit on 2026-09-19 (see Comments). The two subtleties below are settled as follows: a manual run is one claim composed from two sources, the Decision settling the country and Cuisines and the language model writing region and note to them, and it replaces the stored group as a whole; the Levenshtein resolver stays for the language-model path only, and the two paths are compared in this ticket's comments once both exist.

- **Manual runs replace the whole group** (CONTEXT.md, _Recipe Provenance_). With settled slots from a Decision, a manual run would be "Decision settles, language model fills the rest" — still a full replacement of what was stored, but composed from two sources. Confirm that reads as one claim to the person who asked.
- **The note explains the whole claim** (the docs' reason for suppressing automatic provenance on any supplied part). A note written to a settled country is what the gap-fill already does for supplied countries, so this is consistent; but the Levenshtein resolver in `cuisine-resolver.ts` becomes unnecessary on this path and stays for the language-model path, and two paths minting Cuisines differently should be looked at once.

## Notes

The country Choice has about 250 options, inside Jev's 255 limit; label them by code with the English country name as description. `COUNTRY_THRESHOLD` on the chosen option's probability; below it, no slot is settled and the whole group goes to the language model. Cuisines are Booleans keyed by the vocabulary's canonical names with `CUISINE_THRESHOLD`; a vocabulary larger than ticket 04's measured question limit is chunked.

The language-model request for the note takes the settled country and Cuisines as a Prompt Section ("The country is X and the Cuisines are Y; write the region and explanation"), exactly as the gap-fill path does for supplied slots today, and its schema drops the fields already settled.

Everything in `packages/shared/src/lib/recipe-enrichment.ts` (`fillProvenanceGaps`, the country-agreement rule) is reused, not duplicated.

## Acceptance criteria

- [ ] Under `existing` with a Decision Model: a clear country and Cuisines are settled by one `decide` call, and one `generateStructured` call writes the region and note to them; the stored group is consistent (the note names the settled country).
- [ ] An unclear country, the `extend` strategy, no Decision Model, or the Recipe Provenance use switched off: today's single language-model inference, byte-for-byte.
- [ ] No Cuisine outside the vocabulary is ever minted on the Decision path.
- [ ] A manual run replaces the whole stored group with the composed claim, and the note names the settled country.
- [ ] Boundary tests on both constants; existing provenance tests pass untouched.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Comments

- Filed 2026-09-19 with the spec.
- 2026-09-19: Maintainer confirmed the fit and the manual-run semantics above. Promoted to ready-for-agent.
- 2026-09-19 — Implemented. Under `existing` with `isDecisionUseEnabled("recipeProvenance")`, `provenance-inferrer.ts` asks one Choice over the country codes (`countryChoiceCriteria()`: the platform's region names less pseudo-locales, exceptional reservations and deprecated aliases — 251 options, pinned ≤ 255 by a test) and one Boolean per vocabulary Cuisine (`cuisine:<name>` keys), split across requests above `MAX_QUESTIONS_PER_DECISION`. `COUNTRY_THRESHOLD = 0.6` on the chosen option settles the country; `CUISINE_THRESHOLD = 0.6` settles Cuisines; a supplied slot is not asked. Settled slots join the supplied section and `buildProvenanceSchema` drops them, so the language model writes the region, the written country name and the note around them. An unclear country settles nothing (Cuisines included); no Cuisine clearing leaves the Cuisines to the language model and the resolver. A manual run withholds the stored slots, so the Decision settles everything and the composed claim replaces the whole group. The two paths minting Cuisines: the Decision path never touches the resolver (its keys are vocabulary rows), the language-model path keeps Levenshtein and is now validated first (ticket 10). Tests: `provenance-inferrer.test.ts` (+18).
