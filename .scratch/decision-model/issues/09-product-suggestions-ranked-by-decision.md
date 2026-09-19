# 09 — Offered products are ordered by a Decision, never linked by one

Status: needs-triage
Blocked by: 04

Spec: `.scratch/decision-model/spec.md`
Decision records: ADR-0028, ADR-0029, ADR-0030

## What to build

When a grocery's Store search returns products and the auto-link rule (`packages/shared/src/lib/auto-link.ts`, `chooseUnmistakable`) declines to link — the normal case after the 0.23.1 tightening — the grocery panel offers the candidates. With a Decision Model configured, one Choice over the offered candidates plus `none` orders that list and marks a best guess. It **never links**: the auto-link rule, the Miss, and the shopper's own choice are exactly as they are.

## Why it is filed for triage rather than ready

`auto-link.ts` says, in a comment the maintainers wrote on purpose: _"There is no tunable threshold on purpose: there is then no number to re-guess when it misjudges."_ This ticket does not add a threshold to the link decision — the Decision only reorders what is already offered — but it is the same territory, and whether a ranked list with a highlighted guess is welcome in the grocery panel is a product call. The alternative reading is that an ordered list nudges shoppers into the model's guess, which is what the tightening pushed back on.

## Notes

State: `{ grocery: { name, amount, unit }, candidates: [{ id, name, size, price }] }`. Question: a Choice keyed by candidate id plus `none`, instruction "Which product is the grocery the shopper asked for, if any?". The list is ordered by probability, `none` is not shown, and the top candidate is marked as a suggestion only when its probability clears `SUGGESTION_THRESHOLD`. The Store lookup worker does not call this; it is asked from the panel's query path so a shopper who never opens the panel never spends a Decision.

## Acceptance criteria

- [ ] With a Decision Model configured, the offered list in the grocery panel is ordered by the Decision and a clear best guess is marked; nothing is linked without the shopper choosing.
- [ ] Without one, the list is in the shop's order as today.
- [ ] `chooseUnmistakable` and the lookup worker are untouched (their tests pass unchanged).
- [ ] The product decision is confirmed in the comments by a maintainer before implementation.
- [ ] Repo gates green: lint, full test run, internationalization check, production build.

## Comments

- Filed 2026-09-19 with the spec. Maintainer decision requested.
