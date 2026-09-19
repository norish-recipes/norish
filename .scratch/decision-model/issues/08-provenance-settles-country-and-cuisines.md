# 08 — Recipe Provenance settles the country and Cuisines by Decision, and writes the note around them

Status: needs-triage
Blocked by: 04, 05

Spec: `.scratch/decision-model/spec.md`
Decision records: ADR-0012 (Cuisines are curated), ADR-0018 (automatic provenance fills the group's gaps)

## What to build

Under the `existing` cuisine strategy, and when a Decision Model is configured, Recipe Provenance asks a Decision first: a Choice over ISO-3166-1 alpha-2 country codes and one Boolean per Cuisine in the administrator's vocabulary. A clear country and its clear Cuisines become **settled slots**, and the language model is then asked to write the region and the note around them — the exact shape ADR-0018's gap-fill already gives Supplied Recipe Data. When the country is unclear, the strategy is `extend`, or there is no Decision Model, the whole group is inferred by the language model as today.

## Why it is filed for triage rather than ready

The win is accuracy and vocabulary discipline rather than cost: the language-model request still happens for the note. Two subtleties need a maintainer's eye before an agent starts:

- **Manual runs replace the whole group** (CONTEXT.md, _Recipe Provenance_). With settled slots from a Decision, a manual run would be "Decision settles, language model fills the rest" — still a full replacement of what was stored, but composed from two sources. Confirm that reads as one claim to the person who asked.
- **The note explains the whole claim** (the docs' reason for suppressing automatic provenance on any supplied part). A note written to a settled country is what the gap-fill already does for supplied countries, so this is consistent; but the Levenshtein resolver in `cuisine-resolver.ts` becomes unnecessary on this path and stays for the language-model path, and two paths minting Cuisines differently should be looked at once.

## Notes

The country Choice has about 250 options, inside Jev's 255 limit; label them by code with the English country name as description. `COUNTRY_THRESHOLD` on the chosen option's probability; below it, no slot is settled and the whole group goes to the language model. Cuisines are Booleans keyed by the vocabulary's canonical names with `CUISINE_THRESHOLD`; a vocabulary larger than ticket 04's measured question limit is chunked.

The language-model request for the note takes the settled country and Cuisines as a Prompt Section ("The country is X and the Cuisines are Y; write the region and explanation"), exactly as the gap-fill path does for supplied slots today, and its schema drops the fields already settled.

Everything in `packages/shared/src/lib/recipe-enrichment.ts` (`fillProvenanceGaps`, the country-agreement rule) is reused, not duplicated.

## Acceptance criteria

- [ ] Under `existing` with a Decision Model: a clear country and Cuisines are settled by one `decide` call, and one `generateStructured` call writes the region and note to them; the stored group is consistent (the note names the settled country).
- [ ] An unclear country, the `extend` strategy, or no Decision Model: today's single language-model inference, byte-for-byte.
- [ ] No Cuisine outside the vocabulary is ever minted on the Decision path.
- [ ] The manual-run semantics are confirmed in the comments by a maintainer before implementation.
- [ ] Boundary tests on both constants; existing provenance tests pass untouched.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Comments

- Filed 2026-09-19 with the spec. Maintainer decision requested on the two subtleties above.
