# 11 — Recipe Validation: an enrichment kind that checks what a recipe already claims

Status: ready-for-agent
Blocked by: 04, 10

Spec: `.scratch/decision-model/spec.md`
Decision records: ADR-0018, ADR-0025 (what a manual run may replace), ADR-0035

## What to build

**Recipe Validation** becomes the eighth kind of Recipe Enrichment. Where ticket 10 checks a claim at the moment the language model makes it, this kind reads a **stored** recipe — one enriched last year, one imported with tags the source made up, one whose calorie count nobody believed — and asks the Decision Model whether what it claims is right. A clearly wrong tag, category, Cuisine or Step Ingredient is removed; an implausible Nutrition Information group is cleared and, when the automatic nutrition switch is on, estimated again. It reaches recipes through the machinery the other seven kinds already use: the actions menu (**Validate recipe**), and the bulk sweep under **Overwrite existing data**.

## Notes

**Why it is a kind and not a mode of ticket 10.** Ticket 10 only ever sees the claim a run just made, so it cannot touch anything that was already there, and it never sees a number. This kind sees the whole recipe, and it is deliberately routed through the paths the product already treats as deliberate: a manual run is "a deliberate refresh" that may replace what is stored (CONTEXT.md, _Recipe Enrichment_), and the sweep's overwrite mode "does not spare your own work". Validation _removes_, so it belongs on exactly those two paths and nowhere quieter:

- **Manual**, from the recipe's actions menu on web, beside Generate Picture. Lifecycle reported as for every manual kind, and the completion message says what changed ("Removed 2 tags and cleared nutrition" / "Everything checked out").
- **Bulk**, in Enrich All Recipes, **only** when Overwrite existing data is on. The confirmation already warns that overwrite does not spare the cook's work; add one line naming validation.
- **Not automatic.** There is no automatic switch for this kind, because a newly usable recipe's fresh claims are already checked by ticket 10 as they are made, and an automatic run over stored data would remove things a person typed with nobody having asked. The coordinator gets a kind that is never enrolled on the automatic path (skip reason `manual-only`, a new member beside the existing ones).

The Decision Model's **Recipe validation** use switch governs it: off, the manual action is refused with a message naming the switch (the way Generate Picture is refused without an image provider), and the sweep skips the kind with `no-decision-model`.

**Questions, one Decision per recipe, all against the JSON recipe state:**

| Stored claim                     | Question                                                                                                                              | On a clear "no"                                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Each tag (allergy tags excluded) | "Does the tag _X_ apply to this recipe?"                                                                                              | Remove the tag                                                                                                                           |
| Each category                    | "Is this recipe a _dinner_ dish?"                                                                                                     | Remove the category, never the last one (an empty list is what the auto-categorization worker refuses to write)                          |
| Each Cuisine                     | "Is _X_ a Cuisine this recipe belongs to?"                                                                                            | Detach the Cuisine (the vocabulary row stays; an administrator owns it)                                                                  |
| Country                          | "Is this dish from _X_?"                                                                                                              | Clear the whole provenance group (country, region, note, Cuisines) — the note explains the whole claim, so it cannot outlive its country |
| Each Step Ingredient             | "Does step N use ingredient line M?"                                                                                                  | Remove the link; the step goes bare, as Ingredient Linking's gap-fill expects                                                            |
| Nutrition Information            | "Is _N_ kcal per serving plausible for this recipe?" plus one Boolean each for fat, carbohydrates and protein against the ingredients | Clear the whole group (it is atomic), then enqueue nutrition estimation when its automatic switch is on                                  |

Allergy tags are **never** removed by validation, for the reason ticket 10 gives; they are not asked about. The sanity of a Generated Image is not a question (it can only be apt or unconvincing, ADR-0025). The image brief, unit conversion and free text are out of scope.

`DROP_THRESHOLD` is ticket 10's constant, reused through the same `verifyClaims` helper: a claim at or below it is removed, doubt keeps it. Nutrition uses its own `IMPLAUSIBLE_THRESHOLD` because the question is "is this number reasonable", which a model should be more hesitant to deny.

**Writes** go through `packages/db/src/repositories/recipe-enrichment.ts` like every other kind, in one transaction per recipe, and emit the same recipe-updated event so open pages refresh. Nothing is written when nothing was removed.

**Chunking.** A recipe with many tags, Cuisines and Step Ingredients can exceed the per-request question limit ticket 04 measured; chunk by claim type and merge.

## Acceptance criteria

- [ ] `recipe-validation` joins `ENRICHMENT_KINDS`, with a queue, a worker, a coordinator entry that never enrolls automatically, and the bulk sweep running it only under overwrite.
- [ ] **Validate recipe** appears in the web actions menu when AI is on and the Recipe validation use is on; it is refused with a clear message otherwise.
- [ ] A manual run removes clearly wrong tags, categories (never the last), Cuisines and Step Ingredients, clears an implausible nutrition group and, with the automatic nutrition switch on, re-enqueues estimation; the completion message names what changed.
- [ ] Allergy tags are never touched; a test proves it.
- [ ] A recipe where everything checks out is not written to.
- [ ] Supplied-data precedence is documented as **not** applying to this kind, consistent with manual runs and overwrite sweeps, in CONTEXT.md's _Recipe Enrichment_ entry.
- [ ] The E2E AI suite covers the manual action end to end against the fake TypeSafe route.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- An automatic path. Ticket 10 covers fresh claims.
- Correcting a value: validation removes or clears; refilling is the other kinds' job.
- Mobile. Parked.

## Comments

- Filed 2026-09-19 at the maintainer's request ("individual enrichment runs to validate the AI decisions … the calorie estimate, is it within reason").
