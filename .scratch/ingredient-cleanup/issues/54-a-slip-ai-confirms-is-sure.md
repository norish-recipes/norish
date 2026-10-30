# 54: A slip AI confirms is sure

**What to build:** Found on ticket 31's runs on the production copy. A food only a slip of the fingers finds goes to the second question (ticket 26), and the pick was always recorded unsure, flagged with Undo, even where AI was sure: "ansjovisfilet" into anchovy filets (the Decision's `same_1` at 0.97) and "bladpeterselie" into flatleaf parsley.

**Decided (Mike, 2026-10-22):** "lets not flag matches above 90% sure thats fine probably".

**Blocked by:** None

**Status:** done

- [x] A slip the Decision picks at 0.97 is a sure merge, not flagged.
- [x] A slip the Decision picks at 0.85 stays an unsure merge, flagged.
- [x] A slip the language model picks with `sure: true` is sure.

## Implemented (2026-10-22)

- `SURE_SLIP_THRESHOLD = 0.9` beside `RESOLUTION_THRESHOLD` in `packages/shared-server/src/ai/resolution/ingredient-resolution.ts`.
- `Pick` gains `sureOfSlip`: `decideFood` sets it to `probability >= SURE_SLIP_THRESHOLD`, `askLanguageModel` to the answer's `sure` (false for none or a number off the list). `findNamed` is sure where `pick.sure && (exact || sureOfSlip)`, so single foods, split parts, parents and categories share the rule.
- Several exact foods asked about keep their old rule (a Decision pick at 0.8 or more is sure).
- Tests: `review.test.ts` "a reading only a slip of the fingers finds": Decision 0.97 sure, 0.85 unsure, language model sure; the parent case now picks `sure: false` and stays unsure.
- Docs: the 0.26 release-notes line on slips, an ADR-0037 amendment, ticket 26's note.
