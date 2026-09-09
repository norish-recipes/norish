# 03 — The Line Cost, on the row and at the heading

Status: ready-for-human
Blocked by: 02

Spec: `.scratch/grocery-line-cost/spec.md`

## What to build

**The function.** One pure function in `packages/shared`, given a grocery's amount and unit and a product's Shelf Price and Pack Size, returning the cost, the packs counted, whether the amount was matched, and whether it was priced by weight:

- no amount: one pack, matched;
- sold by weight: the amount in the unit of sale times the price, rounded to the cent; a count against a by-weight price is one unit of sale, unmatched;
- a bare number, a piece unit or a container unit: that many packs, except that a pack counted in pieces divides a bare or piece count (12 eieren of "10 stuks" is two packs; 2 cola of "6 x 33 cl" is two packs; 2 pak of anything is two);
- a measure against a measure of the same family: the amount over the Pack Size, rounded up, strictly;
- a different family, an unknown unit, or no Pack Size: one pack, unmatched;
- more than 24 packs by any route: one pack, unmatched.

**The row.** `grocery-price.tsx` shows the Line Cost first and the packs after: `€5.98 · 2 × 500 gram`, the shop's own size words for a read pack and Norish's words for a hand-set one. One pack reads exactly as today. A by-weight line reads `€1.39 · 700 gram`. An unmatched line adds a muted "priced as one pack" note on the second line, after the product name.

**The heading.** `store-total.ts` sums Line Costs of the lines not done, in the currency rule already there; an unmatched line counts its one pack. Each view prices what it shows: the flat list prices every row as its own purchase; the grouped list prices a group from its combined amount when the sources share a unit family, converting through the table (300 g and 0.4 kg price as 700 g while the group still displays them apart), else from the sources' packs added together.

## Notes

Money is added as money, rounded per line, as the existing total does; do not sum floats.

The existing `store-total` test "counts one Shelf Price per line, whatever the line's own amount says" is inverted, not deleted: it now counts two packs for two kilos of a one-kilo pack.

The grouped view's `groupPriceLine` picks one representative grocery today; the group's amount and unit now come from the group, and its product from the representative.

Copy uses the glossary: Line Cost, Pack Size. The note is a note, never an error.

## Acceptance criteria

- [x] A table test covers 700 g of 500 g (2), 1.5 l of 1 l (2), 2 el olie of 500 ml (1), 2 cola of "6 x 33 cl" (2), 12 eieren of "10 stuks" (2), 3 tomaten of "6 stuks" (1), 2 pak melk of 1 l (2), 410 g of "ca. 405 g" (2), 2 kg of "1,5 l" (one pack, unmatched), 30 cola (one pack, unmatched), 700 g bananen per kg (0.7 × price), 2 bananen per kg (one kilo, unmatched), kaas with no amount per kg (one kilo, matched), and a product with no Pack Size.
- [x] The row reads `€5.98 · 2 × 500 gram` for two packs and is unchanged for one.
- [x] A by-weight row reads the cost and the grocery's own weight.
- [x] An unmatched row shows the "priced as one pack" note and nothing else changes.
- [x] The Store heading is the sum of the Line Costs under it in both the flat and the grouped list, and a done line is left out.
- [x] A grouped row of 300 g and 0.4 kg is priced as 700 g.
- [x] `pnpm lint`, `pnpm test:run` and `pnpm i18n:check` pass.
