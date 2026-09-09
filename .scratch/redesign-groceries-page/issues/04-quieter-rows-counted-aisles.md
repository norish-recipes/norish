# 04: Quieter rows and counted aisles

Status: ready-for-agent
Blocked by: 01, and 03 in practice (both rewrite the same section components; land this after it)

Spec: `.scratch/redesign-groceries-page/spec.md`

## What to build

A shopper scrolling a long Store still knows which shop's rows they are in: every checkbox ring is in the Store's colour, and a ticked one fills with it under a white check mark, in the flat, grouped and By Recipe views. A group's indeterminate state does the same. Rows under Unsorted keep the accent. In the By Recipe view each row's checkbox takes the colour of the Store it is assigned to, which becomes that view's only Store hint. The amount before the name stays in the accent.

A row with nothing more to say is one line tall. A second line appears only when there is a recipe name, a recurrence pill, or a Store Product beneath the price; the "Manual Items" subtitle is gone from single manual rows in the grouped view, while the string stays in a mixed group's breakdown line. The drag handle keeps its place, its hit area and its dnd-kit attributes; only its glyph shrinks and fades.

Aisle headings are one size smaller, medium weight, still uppercase and muted. A filled Aisle's name is followed by the number of lines under it, groups in the grouped view; an empty Aisle is fainter and carries no count. Dividers and Aisle drop targets are unchanged.

## Notes

- Vocabulary is CONTEXT.md's: Store, Unsorted, Aisle, Store Product.
- The E2E drag helper finds the handle by dnd-kit's own attributes, not by its glyph; keep those attributes on the activator.
- The 600 ms reorder delay after a tick, the sensors and the drop plan are untouched.
- Prior art: the aisles spec's heading and row locators.

## Acceptance criteria

- [ ] Checkbox ring and done fill take the Store's colour in all three views; Unsorted rows keep the accent; By Recipe rows take their assigned Store's colour.
- [ ] A single manual row has no subtitle in either view; recipe name, recurrence pill and Store Product still appear when present; a mixed group's breakdown line still names manual sources.
- [ ] The handle is smaller and fainter in the same place, and every existing drag E2E still passes unchanged.
- [ ] Aisle headings are smaller with a trailing count when filled, fainter and uncounted when empty.
- [ ] E2E: a filled Aisle heading shows its count and an empty one none; in the grouped view a single manual row shows no subtitle.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm i18n:check`, `pnpm test:e2e` and `pnpm build` pass.
