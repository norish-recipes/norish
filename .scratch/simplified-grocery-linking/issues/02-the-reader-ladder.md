# 02 — Reading a shop page without a model

Status: ready-for-human
Blocked by: 01

Spec: `.scratch/simplified-grocery-linking/spec.md`
ADR: `docs/adr/groceries/0028-store-pages-are-read-with-a-structured-data-ladder.md`

## What to build

One module with two entry points and no model behind either:

- `readSearchResults(html, baseUrl)` → candidates `{ name, url, price?, currency?, size? }` — JSON-LD `ItemList` for the complete name+URL list, a DOM pass over product anchors for the prices, merged on URL.
- `readProduct(html, url)` → `{ name, price, currency, size? }` from `Product` JSON-LD, with meta/microdata as the fallback rung.

Plus the fetcher that feeds them: plain HTTP fetch first with a browser-shaped `User-Agent`, escalating to Obscura on 403, on a challenge-shaped small body, or on zero candidates. And, now that something can fetch, ticket 01's field gains its two live behaviours: **discovery** from a pasted homepage and **verification on save**. Both must work in a language nobody on this project reads (see ticket 01's note on why no search-word vocabulary is allowed to be the primary rule).

Discovery, in three rungs: the `<link rel="search">` OpenSearch descriptor, whose `Url` template carries its own `{searchTerms}` slot and is therefore fully language-neutral; then a `<form role="search">`, or any form containing an `<input type="search">`, taking that input's `name` whatever it is; then, only as a last resort, a form matched against a small search-word vocabulary drawn from the fourteen locales Norish ships rather than from English and Dutch. Failing to discover is a normal outcome, not an error.

Verification uses **the user's own term as the probe**: when the paste contained a real search, that word is known to have results at that shop, so resolve the address with it and report the candidate count. A fixed English probe would report "no products found" against a working Polish shop, blaming the address for the probe's failure. When discovery produced the address and no term is known, report that the shop answered rather than inventing a count. Verification informs; it never gates the save.

## Notes

The fixtures are already captured and committed at `.scratch/simplified-grocery-linking/fixtures/`. They are the whole point of this ticket, and each one pins a specific trap:

- `dirk-search-kaas.html` — a 198-item `ItemList`, but `offers` on only 32 of them, scattered from position 11 to 193, while the DOM carries a price on all 198. A JSON-LD-only reader passes a naive test and shows a sixth of the shelf. The test must assert **198** priced candidates, not "some".
- `dirk-product-97752.html` — `offers` holds `"Price": 7.99`, capital P, which schema.org does not sanction and which the same site does not do on its results page. Key matching is case-insensitive or every Dirk product page silently reads as unpriced.
- `ah-search-kaas.html` — zero JSON-LD blocks, `noindex,nofollow`, 36 product links, and prices only in `aria-label` ("Milner Jong belegen 35+ plakken, Nutri-Score D, 150 gram €2.99"). This is the fixture that proves the DOM rung is load-bearing.

Candidates without a price are dropped before anything downstream sees them (a product decision, not a reader one — the reader may return `price: undefined`, the caller filters).

Price parsing must survive European formatting: `€2,99`, `2.99`, `€ 2,99`, and a `1.234,56` thousands separator. Currency comes from `priceCurrency`, else the symbol, else the website's TLD.

The DOM rung is generic, not per-shop: find anchors whose href looks like a product URL, walk up to the smallest container holding one, and take the price from a currency-shaped string in that container's text or its `aria-label`. If it needs a shop name in a condition, it is the wrong shape — see the rejected alternatives in ADR-0028.

Obscura is reached exactly as the import path reaches it; do not add a second connection or a selector wait (ADR-0019).

## Acceptance criteria

- [x] `readSearchResults` returns 198 priced candidates from the Dirk fixture, each with a name, an absolute URL and a price.
- [x] `readSearchResults` returns 36 candidates from the AH fixture with prices taken from `aria-label`.
- [x] `readProduct` reads `7.99` and `EUR` from the Dirk product fixture, proving case-insensitive key matching.
- [x] European price formats and a thousands separator all parse to the right number.
- [x] Relative product URLs resolve against the page's base URL.
- [x] The fetcher escalates to Obscura on 403, on a challenge-shaped body, and on zero candidates, and not otherwise.
- [x] With Obscura unconfigured, a plain-fetchable shop still reads and an Obscura-only shop fails without throwing.
- [x] Pasting a homepage discovers a Search Address via OpenSearch or a search form, and reports failure as a normal outcome.
- [x] Discovery finds the slot in a form whose input name is in a language the code has no word for, via `role="search"` or `type="search"`.
- [x] Verification probes with the term the user's own paste contained, and never with a hardcoded English word.
- [x] An address discovered from a homepage, with no known term, verifies as "the shop answered" rather than reporting a count of zero.
- [x] Saving a Search Address verifies it and reports a candidate count, no products, or no answer — and saves either way.
