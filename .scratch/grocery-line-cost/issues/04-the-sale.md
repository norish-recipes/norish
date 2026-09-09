# 04 — The Sale

Status: ready-for-human
Blocked by: 03

Spec: `.scratch/grocery-line-cost/spec.md`

## What to build

**The reading.** Two nullable fields on the candidate and reading shapes, on `store_products`, and on the DTO: the regular price and the deal words. On a results card the reader takes a second, higher price as the regular price (Dirk's `regular-price` "van 2.65"; a `del`/`s`/`strike` element, which `NOT_THE_PRICE` skips for the price scan, is read for this purpose) and the card's promotion label text as the words (AH's "2 voor €5.50", Dirk's "VR, ZA & ZO actie"). A product page is read the same way through its DOM; JSON-LD is untouched, since neither shop states a regular price there. Words without a higher price are deal words on a product that is not on Sale. Capture one Dirk product page currently on offer as a fixture, to pin what the page itself states.

**The refresh rule.** A refresh that reads the same price the Sale is at keeps the regular price and the words; one that reads any other price replaces all three with what it read. A hand-typed product is never on Sale.

**The row.** The Line Cost, then the regular Line Cost struck through, then a translated "Sale" badge: `€3.38 ~~€5.30~~ · 2 × 150 g`. The deal words go after the product name on the second line, on Sale or not. The picker shows the badge, the struck pack price and the words on each candidate.

## Notes

There is no card, membership or login detection: the Shelf Price is what the shop presents as the price, and AH keeping its regular price with the deal as a label is exactly what makes "2 voor €5.50" words rather than a markdown. Do not add a vocabulary of card words. Do not compute a multi-buy.

The badge is Norish's word, translated in every locale; the deal words are the shop's and are shown verbatim.

## Acceptance criteria

- [x] The Dirk results fixture reads 31 candidates with a regular price above their price, and the "VR, ZA & ZO actie" words on the ones that carry them.
- [x] The AH results fixture reads "2 voor €5.50" as deal words on seven candidates, none of them on Sale.
- [x] The Dirk on-offer product page fixture reads what the page states, and the refresh rule keeps a Sale the page does not restate at the same price.
- [x] A refresh that reads a different price ends the Sale.
- [x] A row on Sale shows the Line Cost, the struck regular Line Cost and the badge; the deal words follow the product name.
- [x] Picker candidates on Sale show the badge, the struck pack price and the words.
- [x] A hand-typed product shows no Sale.
- [x] `pnpm lint`, `pnpm test:run` and `pnpm i18n:check` pass.
