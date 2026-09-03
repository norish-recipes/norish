# One switch gates every Price Visit, and a visit borrows any member's login

Every Price Visit — a Product Lookup's walk, a Price Refresh, a pasted product page, a search from the picker — is a headless browser reaching a retailer from the operator's server, through the same Obscura sidecar URL import already needs. Enrichment set the house rule that an upgrade must not silently start spending on a self-hoster's behalf, and daily visits to a supermarket from an instance whose administrator never opened settings are the same kind of surprise in a different currency. The finer design gated only the quiet work and let a person's own request through, as URL import does; it was recommended and rejected. **One deployment setting allows or forbids every Price Visit, off by default, and with it off every Store Product is made by hand and every price is a Set Price.** From the retailer's side a person pressing refresh and a job running at dawn are the same visit from the same server, so there is no principled line between them to gate separately, and "prices by hand" is a complete mode rather than a degraded one: totals, Pack Counts and sales-as-set-prices all work.

Background work has no requesting person, so the login question could not be dodged. **A Price Visit carries the Site Auth Tokens any household member holds for the store's domain: the asking person's own first when there is one, and one member's chosen at random otherwise.** The safer answer — public pages only, member prices are what a Set Price is for — was recommended and rejected too, because a supermarket that prices its shelves behind a login is worthless unlinked, and because the household is already the trust boundary here: it shares the list, the stores, and through the Store Preference it already learns from each member's habits. Random choice spreads the visits across members' sessions rather than wearing out one.

## Considered Options

- **Gate only the automatic work.** Lookups and the daily refresh behind the switch; pasting a page, searching from the picker and pressing refresh always allowed, as URL import is. Rejected: three modes to explain, and the retailer cannot tell them apart anyway.
- **No setting.** Rejected as the first thing an operator who did not ask for daily retailer visits would want to switch off.
- **No tokens, ever.** Rejected as above; kept on record because it is the answer a security review will reach first.
- **The store creator's tokens.** One member's cookies become the household's credential by virtue of having made the store. Rejected: arbitrary, and it punishes the person who set things up.

## Consequences

- The switch is documented on the admin-settings configuration page and called out in the release's upgrade notes. When it is off, the store manager says so beside Product Search, so nobody hunts for a broken feature.
- There is no finer switch: not per store, not per household, not "manual visits only". Adding one reopens this ADR.
- A member's token leaves their control in exactly one way: it is sent to the store's own domain on a schedule they did not start, on the household's behalf. It goes to no other domain, is decrypted only inside the isolated browser context as for imports, and is never logged. Removing the token stops it at once.
- Member prices read through one person's login become the household's prices. A Set Price is the correction when members disagree with what the store showed.
- Two refreshes may read the site as two different members. A store that prices per member gives a total that moves between their views by design; that is not a defect.
- Obscura's default deny of private networks remains the only protection against an inward-resolving Store Website, unchanged from ADR-0019. Discovery of a Product Search and every visit stay on the store's own domain and never follow links off it.
- Visits to one domain run one at a time across the whole instance, a few seconds apart. That pace is the instance's promise to retailers and is deliberately not a setting.
