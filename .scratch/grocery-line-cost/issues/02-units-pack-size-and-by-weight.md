# 02 — The unit table, the Pack Size, and prices by weight

Status: ready-for-human

Spec: `.scratch/grocery-line-cost/spec.md`

## What to build

Everything Line Cost needs to know about quantities, and nothing that computes one yet.

**The unit table.** One fixed table in `packages/shared`: for every unit its family (mass, volume, count), its magnitude in grams, millilitres or pieces, and its spellings. Seed the spellings from `packages/config/src/units.default.json` across all fourteen locales, from `parse-ingredient`'s built-ins (kg and kilogram are not in the units map and must be here), and from the words shops print: g, gr, gram, grams, kg, kilo, ml, cl, dl, l, liter, litre, oz, fl oz, lb, st, stuk, stuks, pcs, pieces. Spoons and cups are volume at 5, 15 and 240 ml; a dozen is twelve pieces; container units (pack, pak, box, bottle, can, jar, bag, tub, bar, roll, pot, pouch and their spellings) are marked as meaning packs; anything else resolves to unknown. Map the reader's existing UN/CEFACT codes onto it and delete the code-to-words map that exists only for display.

**The Pack Size.** Three columns on `store_products`: quantity, unit and a by-weight flag, plus a by-hand flag; the shop's size words stay as they are. A reading function takes JSON-LD `weight`/`size`/`netContent` with a unit code first, else parses the size words: `(ca.)? N (x M)? unit`, multiplied out for multipacks ("6 x 33 cl" is 198 cl), pieces for "10 stuks", "8 st." and "Per stuk", and by weight for "per kg" / "per 100 gram" with that quantity as the unit of sale. `upsertReadProduct` writes the reading unless the product's Pack Size is by hand.

**By-weight Shelf Prices.** The reader keeps rejecting a per-unit price beside a pack price and accepts one when it is the only price the card or page states, marking the reading by weight. Capture one search for a loose product on each shop (bananas), the way the existing fixtures were captured, and commit them under `packages/api/__tests__/fixtures/store-pages/`. `format-price.ts` learns to print a by-weight price with its unit of sale.

**The editor.** In the grocery panel's product field, under the linked or picked product: quantity plus a unit select of g, kg, ml, cl, l, oz, lb, fl oz, piece, per kg and per 100 g. It is part of the held choice and written on Save through `chooseProduct`, which sets the by-hand flag. The by-hand product form gets the same optional field. The picker's candidates and the store manager are untouched.

## Notes

The spec before this one refused word lists for search addresses; units are a closed set and this table is the one deliberate exception. Keep it in code, not in admin config: a table nobody can misconfigure is the safer one.

"ca." is read as the number it prefixes. There is no tolerance anywhere; a strict Pack Size is what ticket 03 rounds against.

A hand-set Pack Size is the last word, like a hand-typed price: no reading, match or refresh, may overwrite the three fields while the by-hand flag is set.

The `__tests__` eslint blind spot applies if new source lands under that tree.

## Acceptance criteria

- [x] A table-driven test resolves the units map's spellings in every locale, `parse-ingredient`'s built-ins, and the shop words above to the right family and magnitude, and resolves pinch, handful and slice to unknown.
- [x] Size words "500 g", "1,5 l", "6 x 33 cl", "10 stuks", "8 st.", "Per stuk", "ca. 405 g", "per kg" and "per 100 gram" read to the expected Pack Size; a word the table does not know reads to none.
- [x] JSON-LD `weight`/`size`/`netContent` with a unit code reads to a Pack Size ahead of the size words.
- [x] Two new loose-product fixtures are committed, and the reader offers their by-weight products priced and marked by weight; a per-unit price beside a pack price is still rejected.
- [x] A match and a refresh store the Pack Size; neither overwrites one set by hand.
- [x] The grocery panel edits the Pack Size of a linked or picked product and writes it on Save; the by-hand form takes an optional Pack Size.
- [x] `pnpm lint`, `pnpm test:run` and `pnpm i18n:check` pass.
