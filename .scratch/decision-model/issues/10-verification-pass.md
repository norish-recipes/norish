# 10 — The verification pass: a Decision checks what the language model claimed

Status: ready-for-agent
Blocked by: 04, 05, 06
See also: 11, the Recipe Validation kind, which reuses this helper on stored recipes

Spec: `.scratch/decision-model/spec.md`

## What to build

After a language-model request returns a claim about a recipe, and before the feature applies its domain rules, a Decision checks the claim. Verification only ever **removes or flags**; it never adds. It runs whenever a Decision Model is configured, and a `decide` failure keeps the claim untouched, so the language-model path is never worse for having it. The **Recipe validation** use switch governs enforce: with it off, every kind runs in shadow mode and nothing is dropped, because dropping a claim is something a household sees and shadow logging is not. It ships in two modes per kind, decided by a code constant: **enforce** (a claim the Decision is clearly sure is wrong is dropped) and **shadow** (the verdict is logged, nothing changes) — so a kind can gather a disagreement rate on real recipes before its verdicts are trusted.

## Notes

**One helper, many kinds.** `packages/shared-server/src/ai/enrichment/verification.ts` exposes `verifyClaims({ feature, state, claims, mode })`: it asks one Boolean per claim ("Does this recipe belong to the tag _vegan_?"), returns the claims that survive plus the dropped ones with their probabilities, and logs one line per kind with `mode`, `claimed`, `kept`, `dropped`. Each kind composes its own question wording; the helper owns the plumbing, the shadow/enforce switch, and the rule that any `AIError` from `decide` returns every claim unchanged. `DROP_THRESHOLD = 0.2`: a claim whose probability of being true is at or below it is dropped in enforce mode; everything above is kept. Doubt keeps the claim, because the language model already made it.

**What is verified, and in which mode at launch:**

| Language-model output                                                                     | Question per claim                                                                                                      | Launch mode               | Why                                                                                                                      |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Auto-tagging (all three strategies)                                                       | "Does the tag _X_ apply to this recipe?"                                                                                | enforce                   | Append-only kind; a dropped bad tag costs nothing and tags are the noisiest output in the product                        |
| Ingredient Linking                                                                        | "Does step N use ingredient line M?" (one per proposed link)                                                            | enforce                   | A wrong link shows a wrong amount beside a step; removal leaves the step bare, which later runs may fill again by design |
| Cuisines from the language-model provenance path (`extend` strategy, or no Decision path) | "Is _X_ a Cuisine this recipe belongs to?"                                                                              | enforce                   | Under `extend` the model may mint a vocabulary row; a dropped claim is a row that never exists                           |
| Categories from the language-model fallback in ticket 05                                  | "Is this recipe a _dinner_ dish?"                                                                                       | shadow                    | Ticket 05's Decision path already asked this; here it measures how often the fallback disagrees                          |
| Allergens from the language-model fallback in ticket 06                                   | "Does this recipe contain _X_?"                                                                                         | shadow, **never enforce** | Dropping an allergen tag is the one removal that can hurt someone; this only ever logs                                   |
| Country from the language-model provenance path                                           | "Is this dish from _X_?"                                                                                                | shadow                    | A dropped country would leave a note that names it; needs the composed-claim shape from ticket 08 first                  |
| Recipe extraction (URL, image, video)                                                     | A Score, three levels, "How faithful is this extracted recipe to the source?" on `{ source excerpt, extracted recipe }` | shadow                    | Rejecting an extraction refuses an import; the disagreement rate decides whether enforce is ever right, in a follow-up   |

Extraction lives in `packages/api/src/parser/`, not in enrichment, so its call goes through the same helper imported from `shared-server` — the helper is runtime plumbing, not an enrichment feature, and `api` already imports the runtime.

**Where in each kind.** Verification sits between the language-model call and the kind's domain rules, in the kind's own file, so reading one function still tells the whole story: ask, verify, apply rules. It is not in the runtime (the runtime does not know what a claim is) and not in the coordinator (which decides whether a kind runs, never what it answers).

**Cost.** One extra Decision per language-model request on the verified kinds. Ticket 04's measurements say what that is; if a kind's claims exceed the question limit found there, chunk.

**Promotion from shadow to enforce** is a one-constant change with a comment citing the observed disagreement rate. Allergens are the exception and the constant for that kind is typed so `enforce` is not assignable.

## Acceptance criteria

- [ ] `verifyClaims` exists with the signature above, one `decide` call per invocation, and returns every claim unchanged on any `AIError` or when no Decision Model is configured.
- [ ] Auto-tagging, Ingredient Linking and language-model Cuisines drop claims at or below `DROP_THRESHOLD` in enforce mode; boundary test at 0.20 / 0.21.
- [ ] Categories, allergens, country and extraction log verdicts in shadow mode and change nothing; a test proves the allergen kind cannot be set to enforce.
- [ ] Each verified kind's log line carries `mode`, `claimed`, `kept`, `dropped` and the feature name.
- [ ] With the Recipe validation use off, enforce kinds behave as shadow: verdicts logged, nothing dropped.
- [ ] Existing tests for every touched kind pass untouched with the Decision Model unconfigured.
- [ ] Ingredient Linking's gap-fill rule is unchanged: a dropped link leaves the step bare, never re-links it.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Non-goals

- Verification that adds a claim. That is the kind's own Decision path (tickets 05, 06, 08).
- Verifying free text: the provenance note, the image brief, nutrition values, converted units.
- Persisting verdicts. Logged, like every other request.
- Promoting extraction or country to enforce. Follow-up, with the shadow data in hand.

## Comments

- Filed 2026-09-19 at the maintainer's request.
