# 10 — Every enrichment run validates its own output

Status: ready-for-agent
Blocked by: 04, 05, 06

Spec: `.scratch/decision-model/spec.md`

## What to build

After a language-model request returns a claim, and **before the run writes anything**, a Decision checks it. A tag the model is clearly sure is wrong is dropped from the run's output; a calorie estimate the model is clearly sure is out of reason fails the run so it is asked again; a Step Ingredient it is clearly sure is wrong is not linked. Validation only ever removes or flags, never adds, and it only ever sees **the claims the run itself just made** — never what is stored. That is what keeps a tag someone typed, a category an import supplied, or a link a cook attached out of its reach, on every enrichment kind, automatic and manual alike: those were never in the run's output, so there is nothing to drop.

It runs whenever a Decision Model is configured. The **Validate enrichments** use governs whether a verdict changes anything (enforce); with it off, verdicts are logged and nothing is dropped (shadow), because a dropped claim is something a household sees and a log line is not.

## Why only the run's own output

Nothing in the schema records which stored tags, categories, Cuisines or Step Ingredients were made by AI and which by a person. Validating stored data would therefore remove a cook's own tags with the same confidence as the model's, and the maintainer's rule is that manual data is never removed. The cheapest way to make that true is structural: validation sits between the language-model answer and the repository write, in the kind's own file, and has no access to what is already there. Recording an origin per claim, so stored data could be validated later, is a separate decision not taken here.

## Notes

**One helper, many kinds.** `packages/shared-server/src/ai/enrichment/verification.ts` exposes `verifyClaims({ feature, state, claims, mode })`: one Boolean per claim, returns the claims that survive plus the dropped ones with their probabilities, logs one line per kind with `mode`, `claimed`, `kept`, `dropped`. Each kind composes its own question wording; the helper owns the plumbing, the shadow/enforce switch, and the rule that any `AIError` from `decide` returns every claim unchanged. `DROP_THRESHOLD = 0.2`: a claim whose probability of being true is at or below it is dropped in enforce mode. Doubt keeps the claim, because the language model already made it.

**What each run validates, and its launch mode:**

| Run                                      | Question per claim                                                                                               | On a clear "no", in enforce                                                                                                                        | Launch mode                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Auto-tagging (all strategies)            | "Does the tag _X_ apply to this recipe?"                                                                         | Tag not written                                                                                                                                    | enforce                                      |
| Auto-categorization, language-model path | "Is this recipe a _dinner_ dish?"                                                                                | Category not written; if none survive, the worker's existing empty-list rule makes the run a retryable failure                                     | enforce                                      |
| Ingredient Linking                       | "Does step N use ingredient line M?"                                                                             | Link not written; the step stays bare for a later run                                                                                              | enforce                                      |
| Recipe Provenance — Cuisines             | "Is _X_ a Cuisine this recipe belongs to?"                                                                       | Cuisine not attached (and under `extend`, not minted)                                                                                              | enforce                                      |
| Recipe Provenance — country              | "Is this dish from _X_?"                                                                                         | Whole group not written, run fails retryable (the note explains the country, so neither can survive alone)                                         | shadow                                       |
| Nutrition estimation                     | "Is _N_ kcal per serving within reason for this recipe?" and one Boolean each for fat, carbohydrates and protein | Group not written, run fails as `AIResponseError` (retryable) so the queue asks the language model again; the group is atomic, so no partial write | shadow                                       |
| Allergy detection, language-model path   | "Does this recipe contain _X_?"                                                                                  | **Never enforced.** Logged only; dropping an allergen is the one removal that can hurt someone                                                     | shadow, typed so `enforce` is not assignable |
| Recipe extraction (URL, image, video)    | A three-level Score, "How faithful is this extracted recipe to the source?"                                      | Nothing yet; the disagreement rate decides whether refusing an import is ever right, in a follow-up                                                | shadow                                       |

Extraction lives in `packages/api/src/parser/`, so its call imports the same helper from `shared-server`; the helper is runtime plumbing, not an enrichment feature.

**Where in each kind.** Between the language-model call and the kind's domain rules, in the kind's own file, so one function still reads ask, validate, apply rules. Not in the runtime (it does not know what a claim is) and not in the coordinator (it decides whether a kind runs, never what it answers). The Decision-first paths of tickets 05, 06 and 08 are not validated again: their answer already is a Decision.

**Manual runs** are validated exactly like automatic ones. A manual run replaces what is stored with the run's output; validation shapes that output before the replacement, and still never reads what is being replaced.

**Cost.** One extra Decision per language-model request on the validated kinds; chunk if a run's claims exceed the question limit ticket 04 measured.

**Promotion from shadow to enforce** is a one-constant change with a comment citing the observed disagreement rate. Nutrition and country are the first candidates once the data is in.

## Acceptance criteria

- [ ] `verifyClaims` exists with the signature above, one `decide` call per invocation, and returns every claim unchanged on any `AIError` or when no Decision Model is configured.
- [ ] Auto-tagging, auto-categorization, Ingredient Linking and Cuisines drop claims at or below `DROP_THRESHOLD` in enforce mode; boundary test at 0.20 / 0.21.
- [ ] Country, nutrition, allergens and extraction log verdicts in shadow mode and change nothing; a test proves the allergen kind cannot be set to enforce.
- [ ] A test per kind proves validation never reads or writes stored data: a recipe with a person's tag and a model claim of the same name keeps the tag whatever the verdict.
- [ ] With the Validate enrichments use off, enforce kinds behave as shadow.
- [ ] Each validated run's log line carries `mode`, `claimed`, `kept`, `dropped` and the feature name.
- [ ] Existing tests for every touched kind pass untouched with the Decision Model unconfigured.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Validating stored data, or recording which stored claims were AI-made. Separate decision.
- Validation that adds a claim. That is the kind's own Decision path.
- Free text: the provenance note, the image brief, converted units.
- Persisting verdicts.

## Comments

- Filed 2026-09-19 at the maintainer's request.
- 2026-09-19: Maintainer: validate the existing enrichments' output, not a new kind; manual data must never be removed. Rewritten so validation only sees the run's own claims before they are written; the separate "Recipe Validation kind" ticket is withdrawn.
