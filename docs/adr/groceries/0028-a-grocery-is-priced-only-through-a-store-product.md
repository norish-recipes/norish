# A grocery is priced only through a Store Product

A grocery has always been a free-text line — a name, an amount, a unit — sorted into a store by a per-member Store Preference that learns where you put things. Asking Norish to know what the trip will cost invites the obvious column: a price on the grocery. It would ship in an afternoon and it would be wrong by the following week, because a price is not a fact about a line of text. It is a fact about one specific item at one specific store, it changes without anyone editing the list, and the same item is asked for under several names — "milk", "melk", "halfvolle melk" — by a household whose recipes come in more than one language. **A price therefore lives only on a Store Product, one specific item a store sells, and a grocery is priced only by pointing at one through a Product Link: one link per store and normalised name, shared by the whole household, so that the next "melk" bound for the same store is priced without anyone asking.** Totals are derived from those links at read time and stored nowhere. The grocery line stays exactly what it was.

The link is household-wide where the Store Preference is personal, and that asymmetry is the point. Which store you buy milk at is a habit and differs between members; which carton that store sells is a fact about the store, and a data model that let two members disagree about it would be modelling an argument nobody wants to have. It is keyed by the same normalised name the Store Preference uses, so the two memories can never disagree about what "the name" is. Norish does not compare stores: a grocery has one store and therefore at most one product, and "where is this cheapest" would need a product per store per name plus a comparable unit between them. That is a different feature with a different cost, and this record is the explicit no.

## Considered Options

- **A price on the grocery line.** Cheapest by far. Rejected because nothing is remembered — next week's "milk" is unpriced again — and a fetched price has nothing durable to refresh.
- **Price fields on the Store Preference.** Grow "milk goes to Albert Heijn" with a page and a price. Rejected because it forces one preference per name, so language variants can never share a product, and because the preference row would inherit a lifecycle — refreshes, sales — it was never built for.
- **Per-member Product Links,** mirroring the Store Preference's fallback chain. Rejected because the store total would then depend on who is looking.
- **Package arithmetic,** counting packs from the recipe amount and the product's size. Deferred: package sizes are prose in the store's language, the conversion needs the AI path, and a whole-pack estimate that is occasionally one pack short beats one that is confidently wrong in both directions.

## Consequences

- "Set the price myself" means making or editing a product at the store, never typing a number on the line. The product picker has a by-hand door for exactly that, and a hand-made product simply has no page.
- Unsorted groceries are always Unpriced, since a link needs a store. Moving a grocery between stores re-prices it under the destination's links, and may start a Product Lookup there.
- A grocery costs its product's price times its Pack Count, one unless a person says otherwise. Grouped rows are priced by their first source, and choosing a product on a grouped row links every name in the group.
- A Set Price outranks the Store Price until the person clears it, while refreshes keep recording underneath; a Sale is the store's claim and nothing else. The precedence is the one Supplied Recipe Data already sets for enrichment.
- Currency is whatever the product's page advertises and one currency per store is assumed. A product in another currency than its store's siblings is Unpriced with a reason, never summed.
- Only the latest read is kept. Price history is the honest prerequisite for any "went up since last week" feature, not a thing to add quietly.
- A product page that has vanished leaves an ageing price that says how old it is; nothing unlinks on its own.
- Deleting a store takes its products and links; deleting a product unprices what pointed at it.
- Wanting to compare stores reopens this ADR: it needs the one-store-per-grocery assumption removed and a comparable unit across products, and neither is a small change.
