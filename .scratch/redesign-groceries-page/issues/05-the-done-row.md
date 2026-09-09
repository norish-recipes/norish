# 05: The done row

Status: ready-for-human
Blocked by: 03

Spec: `.scratch/redesign-groceries-page/spec.md`

## What to build

As a shopper ticks things off, the Store's card gets shorter. Ticked rows no longer sit at full height under a DONE label; they fold into one row at the bottom of the card that reads "3 done" with its own chevron, in the flat, grouped and By Recipe views. The row is closed on every load. Tapping it opens the done rows exactly as they render today, struck through with the checkbox filled; tapping again closes it. Ticking a row moves it into the tail after the existing reorder delay and the count follows; unticking a row in the open tail returns it to its Aisle. A section with nothing done has no done row. A fully ticked Store's card is the done row alone under its All done heading. Mark all done and Delete done stay in the heading's kebab and gain no twin on the row.

## Notes

- Vocabulary is CONTEXT.md's: Store, Aisle. The spec calls this the done row.
- The count uses the existing "{count} done" string; the DONE heading's string leaves every locale.
- The row keeps the done heading's existing test hook and adds a state attribute for open and closed, so the E2E can find and drive it.
- Open state is not persisted.
- Prior art: the aisles spec's "sinks into the Store's done tail" test, which is rewritten against the row and its state.

## Acceptance criteria

- [x] In all three views the done rows fold into one "N done" row at the bottom of the card, closed on load, opening and closing on tap.
- [x] Ticking folds a row into the tail after the existing delay and the count updates; unticking from the open tail returns the row to its Aisle.
- [x] A section with nothing done shows no done row; a fully ticked Store shows the done row alone under All done.
- [x] E2E: the existing done-heading assertions are rewritten against the done row; ticking, opening, unticking and the row's return are covered.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
