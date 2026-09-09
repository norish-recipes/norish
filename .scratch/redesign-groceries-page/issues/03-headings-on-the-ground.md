# 03: Headings on the ground, rows in a card

Status: ready-for-human
Blocked by: 02

Spec: `.scratch/redesign-groceries-page/spec.md`

## What to build

A shopper opens the list and sees each Store, and Unsorted, as a heading directly on the page ground with its rows in a white card beneath it: the dot, the name, "4 items · €17.86" in muted text, the chevron, the kebab. The tinted header is gone. The count is what is left; with no total the meta is the count alone. Collapsing a Store leaves its heading line alone; an empty Store, and an empty Unsorted, is its heading line alone with no card and no "no items" sentence. A Store where everything is ticked swaps its dot for a filled circle in its colour with a white check mark and reads "All done"; its card still shows the done tail as it renders today, until ticket 05 folds it.

Drag and drop keeps working through every state. The sortable container wraps heading and card together, the heading keeps its drop-target attribute, a card takes the accent ring while targeted, and a bare heading takes a soft accent fill while targeted. Nothing is added to or removed from the page when a drag starts. Headings do not stick. Collapse state is not persisted, as today.

The same shape applies to the grouped view, to the By Recipe view (no dot, count meta, same card) and to the loading skeleton, which becomes a heading line over a card of row placeholders.

## Notes

- Vocabulary is CONTEXT.md's: Store, Unsorted, Aisle, Line Cost. The spec calls the two parts the heading and the card.
- The remaining count uses the existing "{count} items" string; "All done" is new in all fourteen locales; "No items in this store" leaves every locale.
- The Store total is unchanged: the sum of the Line Costs still to buy.
- Sticky headings are out: dnd-kit measures drop rectangles once per drag and a sticky heading would drift from its measured place during auto-scroll.
- Prior art for the E2E: the aisles spec's Store block and heading locators, the prices spec's total assertion, and the drag helper, which is untouched.

## Acceptance criteria

- [x] Each section is a heading on the ground over a white card, in the flat, grouped and By Recipe views, light and dark, phone and desktop; no tinted header remains.
- [x] The heading meta reads the remaining count and the total, or the count alone, or "All done" with the check-in-dot when nothing remains and something is done.
- [x] A collapsed or empty section is its heading alone; the empty-card sentence is gone.
- [x] E2E: a Store heading shows its remaining count and total and no icon; an empty Store is a bare heading that still receives a dropped row and grows its card; a fully ticked Store reads All done.
- [x] Dragging shows the ring on a targeted card and the soft fill on a targeted bare heading, and nothing on the page moves at drag start.
- [x] The skeleton follows the new shape.
- [x] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
