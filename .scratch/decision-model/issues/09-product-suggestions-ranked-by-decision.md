# 09 — A Decision orders the offered products, and links one it is sure of

Status: ready-for-agent
Blocked by: 04

Spec: `.scratch/decision-model/spec.md`
Decision records: ADR-0028, ADR-0029, ADR-0030

## What to build

When a grocery's Store search returns products and the auto-link rule (`packages/shared/src/lib/auto-link.ts`, `chooseUnmistakable`) declines to link — the normal case after the 0.23.1 tightening — a Decision Model with its Grocery linking use on asks one Choice over the candidates plus `none`. Two outcomes:

- The chosen product's probability clears `LINK_THRESHOLD` (start at 0.9): the grocery is **linked** to it, exactly as an unmistakable name match links today, and the row gets its price.
- It does not: nothing is linked. The grocery panel's offered list is **ordered** by the Decision and the top candidate is marked as a suggestion when it clears the lower `SUGGESTION_THRESHOLD`.

`chooseUnmistakable` runs first and is unchanged; the Decision is a second linking route behind it, never a replacement for it.

## Decided

The maintainer confirmed on 2026-09-19 that the Decision may link when its probability is high, and otherwise orders the offered list with a marked best guess. The reasoning that made this a question is kept for the record, because it says where the threshold sits:

`auto-link.ts` says, in a comment the maintainers wrote on purpose: _"There is no tunable threshold on purpose: there is then no number to re-guess when it misjudges."_ That rule was about a _string-similarity_ number, which has no meaning a person can reason about. A Decision's probability is a different kind of number: it is the model's stated chance that this product is the grocery, so `LINK_THRESHOLD` is a statement of how sure Norish wants to be before pricing a row on a shopper's behalf, and it is a named constant with a test rather than a setting. The shopper can still unlink (0.23.1), and the panel still offers every candidate.

## Notes

State: `{ grocery: { name, amount, unit }, candidates: [{ id, name, size, price }] }`. Question: a Choice keyed by candidate id plus `none`, instruction "Which product is the grocery the shopper asked for, if any?".

The linking outcome runs in the Store lookup worker (`packages/queue/src/store-lookup/lookup.ts`, after `chooseUnmistakable` returns null and before the Miss is written), so a linked row is priced the way an unmistakable one is and the same product reading and Sale rules apply. A link the Decision made is recorded on the Product Link the way a shopper's own choice would be, so unlinking works unchanged and a later lookup does not re-link a product the shopper rejected: a Miss written after an unlink stays a Miss (respect whatever 0.23.1 stores for that).

The ordering outcome is served from the panel's query path, using the same Decision's distribution kept with the lookup result, so opening the panel spends nothing extra. `none` is never shown.

Both thresholds are named constants; ticket 04's measurements and a comment in this ticket record what was tried.

## Acceptance criteria

- [ ] With the Grocery linking use on: a candidate at or above `LINK_THRESHOLD` is linked by the lookup worker and priced; below it nothing is linked, the offered list is ordered by probability, and a candidate at or above `SUGGESTION_THRESHOLD` is marked.
- [ ] `chooseUnmistakable` still runs first and its tests pass unchanged; the Decision is asked only when it returns null.
- [ ] A product the shopper unlinked is not re-linked by a later lookup's Decision.
- [ ] Without a Decision Model, or with the use switched off: the Miss, the shop-ordered list and the auto-link rule are byte-for-byte today's.
- [ ] Boundary tests on both constants.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Comments

- Filed 2026-09-19 with the spec.
- 2026-09-19: Maintainer confirmed the fit. Promoted to ready-for-agent.
- 2026-09-19: Maintainer: the Decision may link when its probability is high. `LINK_THRESHOLD` added; the lookup worker becomes the place it runs.
