# Grocery Line Cost

Status: ready-for-human

## Problem Statement

Simplified grocery linking (`.scratch/simplified-grocery-linking/spec.md`) taught a Store to read a shop and put one Shelf Price on a grocery row. It stopped there on purpose: a Store's heading counts one Shelf Price per row whatever the row says, so "700 g flour" against a 500 g pack is priced as one pack, "2 cola" as one bottle, and a kilo of bananas sold loose as nothing at all, because the reader throws per-kilo prices away. The number at the top of the list is therefore a number the till will never show, and the feature's one promise, knowing what this week costs, is not kept.

Two smaller gaps sit beside that one. A grocery whose name the Store has never seen looks exactly like a grocery the Store has given up on: the row is blank while the queue works and blank when the shop has answered "nothing", and a shopper cannot tell waiting from failure. And a shop's deals are invisible: Dirk marks a third of a cheese shelf down and Norish reads the marked-down price without saying so, while Albert Heijn's "2 voor €5.50" is dropped on the floor.

This feature is about correct pricing and telling the shopper what Norish knows: how many packs a line needs and what they cost, that a lookup is still running, and that a price is a deal.

## Solution

Every Store Product gains a **Pack Size**: what one Shelf Price buys, as a quantity and a unit, read out of the shop's own size words ("500 g", "6 x 33 cl", "10 stuks", "per kg") and correctable by hand where the reading is wrong. A grocery's own amount is reconciled against it into a **Line Cost**: as many whole packs as the amount needs at the Shelf Price, or, for what is sold loose, the amount's weight at the by-weight price. A bare number is a number of packs, unless the shop counts the pack in pieces, in which case it is a number of pieces. Where the two cannot be reconciled the line costs one pack and says so quietly. The Store's heading becomes the sum of the Line Costs still to buy under it.

A Product Link gains a third state beside a link and a Miss: a **Pending Link**, a name the Store has been asked for and has not yet answered. It is a fact about the Store, so every household member sees the same loader on the row until the answer lands, and a shop that says nothing leaves no Pending Link behind.

A **Sale** is read from what the shop presents: a Shelf Price with the regular price it replaces beside it, together with the shop's own words for the deal. The row shows the regular Line Cost struck through with a badge, and the deal words next to the product name. A deal the shop keeps as words over its regular price is shown in those words and never worked into the number.

## User Stories

1. As a shopper, I want to see that Norish is still asking the shop about a grocery I just added, so that a blank price reads as waiting and not as failure.
2. As a household member, I want to see that same loader on my own screen, so that we are looking at one list.
3. As a shopper, I want "700 g flour" priced as the two 500 g packs I will have to buy, so that the number at the top is the number at the till.
4. As a shopper, I want "2 cola" priced as two of whatever the shop sells, so that a bare number means what I meant by it.
5. As a shopper, I want "12 eggs" priced as two boxes of ten, so that a count the shop also counts is not twelve boxes.
6. As a shopper, I want "2 pak melk" priced as two packs, so that a container word means packs.
7. As a shopper, I want a kilo of bananas sold loose priced by weight, so that 300 g of them is not rounded up to a kilo.
8. As a shopper, I want the row to show how many packs it counted and of what size, so that I can see why the number is what it is.
9. As a shopper, I want a line Norish could not work out to still show a price, with a quiet note that it counted one pack, so that a linked product is never priced at nothing.
10. As a shopper, I want to correct the pack size Norish read, so that a wrong reading costs me one tap and stays corrected for my household.
11. As a shopper, I want a pack size I set never overwritten by a later reading, so that my correction is the last word.
12. As a shopper, I want a hand-typed product to take a pack size too, so that a shop Norish cannot read still prices by amount.
13. As a shopper, I want to see when a price is a deal, and what it would have cost, so that I know why this week is cheap.
14. As a shopper, I want the shop's own words for a deal on the row, so that "2 voor €5.50" is something I can act on at the shelf.
15. As a shopper, I want a deal to stay a deal until the shop shows another price, so that a refresh does not quietly lose it.
16. As a shopper, I want the grouped list to price two recipes' flour as one purchase, so that the list I shop from adds up.
17. As a self-hosting operator, I want none of this to add a shop visit or a model call, so that pricing stays free and polite.

## Implementation Decisions

**Pending Link.** A `store_product_links` row with no product and no `triedAt` (the column becomes nullable). The producer writes it when it enqueues a match job; the job replaces it with a link or a Miss, and deletes it when the shop did not answer or the job gave up, so an unanswered name goes back to unknown and is asked again on a later view, an hour on at the soonest, exactly as today. A Pending Link older than the match retry window counts as unknown to the producer, so a row a dead worker left behind does not stop the next question. It rides the existing `linkUpdated` event and the existing merge by store and normalized name; `ResolvedProductLink.triedAt` becomes nullable and nothing else on the wire changes. On the row it is a plain loader where the price would be, with an accessible label and no words on screen. A client-side valve treats a Pending Link older than five minutes as unanswered, so a spinner can never outlive the queue. The grocery panel's product field waits on a Pending Link instead of searching the shop itself, and takes the answer when it lands; typing a different term searches at once, as now.

**One unit table, in code.** `packages/shared` gains a fixed table of units: family (mass, volume, count), magnitude in grams, millilitres or pieces, and spellings. Spellings are seeded from the units map's fourteen locales, `parse-ingredient`'s built-ins, and the words shops print (g, gr, gram, kg, kilo, ml, cl, dl, l, liter, litre, oz, fl oz, lb, st, stuk, stuks, pcs, pieces). Spoons and cups are volume (5, 15 and 240 ml); a dozen is twelve pieces; container units on a grocery (pack, pak, box, bottle, can, jar, bag, tub, bar, roll, pot, pouch) mean packs; everything else the table does not know (pinch, handful, slice, clove, bunch) is unknown and falls to the marker. The spec before this one refused word lists for search addresses because search words are open-ended; units are a closed set, and a table nobody can misconfigure beats an admin setting. The reader's existing UN/CEFACT map (GRM, KGM, LTR, MLT, ONZ, LBR, piece codes) feeds the same table.

**Pack Size.** Read at match and refresh time and stored on `store_products` as quantity, unit and a by-weight flag, next to the shop's size words, which stay as they are for display. The reading takes JSON-LD `weight`/`size`/`netContent` with a unit code first, else the size words: `(ca.)? N (x M)? unit`, where "6 x 33 cl" is 198 cl of volume, "10 stuks" and "8 st" are ten and eight pieces, "Per stuk" is one piece, and "per kg" / "per 100 gram" is sold by weight with that unit of sale. "ca." is read as the number it prefixes; there is no tolerance. A hand-set Pack Size is flagged and never overwritten by a reading. It is edited in the grocery panel's product field, under the linked or picked product, as quantity plus a unit select that includes the by-weight forms, and written on Save with the rest of the choice; the by-hand product form gets the same optional field. Nowhere else.

**By-weight Shelf Prices.** The reader keeps rejecting a per-unit price printed beside a pack price (that is the comparison number Norish does not show) and now accepts one when it is the only price a card or page states: that is a product sold loose, and its Shelf Price is what a kilo, or a hundred grams, costs. This amends ADR-0028 and is recorded in ADR-0029. Two new fixtures pin it, a search for a loose product on each of the two shops.

**Line Cost.** One pure function in `packages/shared`, given a grocery's amount and unit and a product's Shelf Price and Pack Size:

- no amount: one pack, no marker;
- sold by weight: the amount converted into the unit of sale times the price, rounded to the cent; a count against a by-weight price is one unit of sale with the marker;
- a bare number, a piece-unit amount, or a container-unit amount: that many packs, except that a pack counted in pieces divides a bare or piece-unit count (12 eggs of a 10-pack is two packs, 2 cola of a "6 x 33 cl" pack is two packs, 2 pak of anything is two);
- a measure against a measure of the same family: the amount divided by the Pack Size, rounded up, strictly, so 410 g against "ca. 405 g" is two;
- a different family, a unit the table does not know, or a product with no Pack Size: one pack with the marker;
- more than 24 packs by any route: one pack with the marker.

Money is added as money, rounded per line as the existing store total does. The row shows the Line Cost first and the packs after: `€5.98 · 2 × 500 gram`, the shop's words for a read pack and Norish's words for a hand-set one; one pack reads exactly as today; a by-weight line reads `€1.39 · 700 gram`. The marker is a muted "priced as one pack" note on the row's second line; the fix is the Pack Size editor in the panel. The Store's heading is the sum of the Line Costs of the lines not done, in the currency rule already there. Each view prices what it shows: a flat row is its own purchase, and a grouped row is priced from the group's combined amount when its sources share a unit family (300 g and 0.4 kg price as 700 g even though the group still displays them apart), else from its sources' packs added together.

**Sale.** Two nullable columns on `store_products`, the regular price and the deal words, and the same two fields on the candidate and reading shapes. On a results card the reader takes a second, higher price as the regular price (Dirk's "van 2.65"; a `del`/`s`/`strike` element, which the price scan skips today, is read for this purpose) and the card's promotion label as the words (AH's "2 voor €5.50", Dirk's "VR, ZA & ZO actie"); a product page is read the same way, and JSON-LD stays as it is, since neither shop states a regular price there. Words without a higher price are deal words on a product that is not on Sale. A refresh that reads the same price the Sale is at keeps the regular price and the words; one that reads any other price ends the Sale. A hand-typed product is never on Sale. The row shows the Line Cost, the regular Line Cost struck through, a translated "Sale" badge, and the deal words after the product name on the second line; the picker shows the badge, the struck pack price and the words on each candidate. There is no card or membership detection and no deal arithmetic: Norish prices what the shop presents as the price, and says the rest in the shop's words.

**Realtime, queue and refresh** are unchanged in shape: the same events carry the new fields, matches and refreshes read the same pages they read today, and no visit is added.

## Testing Decisions

The unit table and the Pack Size reading get table-driven tests over real shop words, including the spellings the units map carries for Cyrillic and Hangul locales, the AH "ca. 1006 g" and Dirk "8 st." forms, and the JSON-LD unit codes.

The Line Cost function gets one table of the scenarios this design was argued through: 700 g of 500 g, 1.5 l of 1 l, 2 el olie of 500 ml, 2 cola of "6 x 33 cl", 12 eieren of "10 stuks", 3 tomaten of "6 stuks", 2 pak melk of 1 l, 410 g of "ca. 405 g", 2 kg of "1,5 l" (marker), 30 cola (marker), 700 g bananen per kg, 2 bananen per kg (marker), kaas with no amount per kg (one kilo, no marker), and a product with no Pack Size.

The reader is pinned by four new committed fixtures: a loose-product search on each shop, and a Dirk product page currently on offer, captured once each the way the existing fixtures were. The existing `store-total` test that counts one Shelf Price per line whatever the amount says is inverted, not deleted.

Browser E2E stays against the harness's fake shop page, which gains a pack size on every product, one product on Sale with a regular price and deal words, and one product sold by weight. The auto-link scenario asserts the loader before the price; a new scenario adds "700 g" of a 500 g product and reads two packs at the heading. Nothing visits a real shop.

## Out of Scope

- Deal arithmetic: "2 voor €5.50" is shown, never computed.
- Card, membership or login-gated prices: not detected, not modelled.
- Comparable unit prices (€/kg beside a pack) and price history.
- Fuzzy auto-matching: the rule in ADR-0028 stands unchanged.
- A tolerance on pack rounding, and a per-line "packs needed" override; the amount and the Pack Size are the two knobs.
- Converting the grouped view's displayed amounts across units; only pricing converts.
- A sale end date; neither shop states one, and the deal words carry it where the shop says so.
- `apps/mobile`: web only, as before.

## Further Notes

- Vocabulary is in `CONTEXT.md` under **Groceries & Stores**: Pending Link, Pack Size, Line Cost, Sale, and the amended Shelf Price. Use those words in code, tickets and UI copy.
- ADR-0029 records why Line Cost is strict pack arithmetic over what the shop presents, and amends ADR-0028's rejection of per-unit prices.
- This ships on the same unmerged branch as simplified grocery linking, so the `0.23.0-beta` release-notes page and `apps/docs/docs/groceries/prices.md` are extended rather than given new pages; the "What this does not do yet" list there is rewritten.

## Amendments

**2026-09-07, Purchase Amount and the panel's shape.** ADR-0030 amends the
out-of-scope line above that ruled out a per-line override: a grocery now
carries an optional **Purchase Amount** (migration `0049`), chosen in the
panel's **Amount** stepper and multiplied against the Shelf Price; the
grocery's own amount and unit stay untouched, and clearing it goes back to the
calculation. The row reads `€4.38 (2 × €2.19)`. On the same day the panel and
the row were reshaped from Mike's review of them:

- A Sale reads the way a shelf tag does and no louder: the regular Line Cost
  struck through and the new one beside it on the money line, the same size
  and weight as any other price; the shop's own words for the deal are the
  price's title, not a badge or chip of their own (a badge line under the
  price and a chip around the price were both tried and rejected). Words
  without a regular price ("2 voor €5.50") leave the price as it is, with the
  words as its title. The picker's rows read the same way
  (`components/groceries/sale-price.tsx`).
- The grocery panel links to the product's own page at the shop, beside the
  product field, for a product Norish read there (`product-page-link`).
- Manage Stores adds or edits a Store in a nested panel of its own
  (`stores/store-editor-panel.tsx`) over the list, as every editor does; the
  inline form under the list is gone.
- A product corrected by hand (name, currency or price typed over it) keeps
  the size, pack, regular price and deal words of the product it corrects,
  carried on the manual choice and written to the by-hand product; whether it
  is still a Sale is the typed price against the regular one. This replaces
  "a price typed by hand is never on Sale".
- The panel's order is name, recurrence, Store, product, amount and price. The
  recurrence control reads **Configure recurrence** (`panel.addRepeat`) and
  sits directly under the name, as the pills do.
- The product's name, currency and pack live behind a **Product details** row
  that sums up the currency and pack and opens a nested Panel, the way the
  recurrence editor does; the Pack Size is read-only there.
- A price that is not a number and a currency that is not three letters are
  said so under their fields, and Save/Add wait for the fix
  (`onValidityChange` on `GroceryProductField`).

The documentation screenshots are re-captured by
`.scratch/grocery-line-cost/docs-screenshots.e2e.ts` (moved here from the
simplified-grocery-linking folder and extended); it is not part of the gate.
