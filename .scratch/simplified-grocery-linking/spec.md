# Simplified Grocery Linking

Status: ready-for-agent

## Problem Statement

A Norish Store is a coloured heading. It groups a household's groceries and does nothing else: it knows the name someone typed, not the shop it stands for. So the list says what to buy and never what it costs, and the household that wants to know whether this week is expensive has to guess, or open a supermarket app beside the one they are already in.

The obvious way to close that gap is to teach Norish to read shop websites, and the obvious way to read a website in 2026 is to hand it to a model. That instinct is wrong here, and expensively so: it makes prices a paid feature of a self-hosted app, it makes a shop visit cost a model call, and it fails in a way nobody can debug. A supermarket search page is not prose to be understood. It is a list already marked up for a search engine, and where the markup is thin the price is still sitting in an attribute waiting to be read.

This is the first, deliberately small step: link a Store to a real shop, learn what a grocery name means there, and show what one pack costs. Everything a richer pricing feature would want — totals, comparable unit prices, pack arithmetic, history — is left for later on purpose, because none of it is worth designing before the reading works.

## Solution

A **Store** gains a website and a **Search Address**: its search page with a `{query}` slot standing where the term goes. The user never authors that template. They paste what they already have — the shop's homepage, or a search they just ran — and Norish templates the slot, shows the resolved preview, and verifies it on save by running it once and reporting what it found.

Reading a shop page is a fixed ladder with no model in it. A results page yields candidates from `application/ld+json` `ItemList` (complete, clean names and product URLs) merged on URL with a DOM pass over the product anchors (the prices); a product page yields the authoritative **Shelf Price** from `Product` JSON-LD. A plain HTTP fetch is tried first, and Obscura renders only when the plain fetch is blocked or empty-handed (ADR-0028).

What a shop has taught Norish is kept as a **Product Link**: a Store, a normalized grocery name, and the **Store Product** it resolves to. It is keyed by name rather than by Grocery on purpose, so it outlives the list line that prompted it — next week's "melk" is priced instantly, without asking the shop again — and a **Miss** is recorded the same way, so a name no shop stocks is not searched every time the list is opened.

Adding a grocery therefore never waits on a supermarket. A name the Store already knows is priced from its link in the same response. A name it does not goes to an always-on lookup queue, and the price arrives live when it lands. A silent auto-link happens only where a human would not hesitate: the normalized names are equal, or every word of the grocery's name appears in exactly one product's name. Anything less certain leaves the grocery unpriced with a one-tap invitation to choose.

That invitation opens the **picker**, a stage inside the grocery panel rather than a second panel over it. It searches the Store on open and says so while it works, offers the priced results, lists the Store Products already known underneath, takes a different search term, and — when a shop yields nothing at all — offers to take a price by hand. Nothing is written until the panel's own Save.

## User Stories

1. As a shopper, I want to point a Store at the shop's website by pasting a link I already have, so that setting it up costs me no thought.
2. As a shopper, I want a search I ran myself to be accepted as the Search Address, so that I never have to understand what `{query}` means.
3. As a shopper, I want to be told what the address found the moment I save it, so that a wrong link is caught while I am still holding it.
4. As a shopper, I want to correct an address Norish guessed wrong, so that a bad guess costs one keystroke rather than a support thread.
5. As a shopper anywhere, I want my local shop understood whatever language it searches in, so that a self-hosted app is not usable only where its authors happen to shop.
6. As a shopper, I want a Store with no website to keep working exactly as it does today, so that pricing is something I opt into.
7. As a shopper, I want a grocery whose name my Store already knows to show its price immediately, so that a weekly list is priced without waiting.
8. As a shopper, I want adding a grocery never to wait on a shop, so that adding six things in a row stays as fast as it is now.
9. As a shopper, I want an unmistakable match to be linked without asking me, so that the obvious cases cost me nothing.
10. As a shopper, I want an ambiguous match left to me, so that I am never quietly shown the price of the wrong thing.
11. As a shopper, I want to open a picker on any grocery and choose from what the shop sells, so that I can fix or make a match deliberately.
12. As a shopper, I want the picker to tell me it is searching, so that a slow shop reads as progress rather than as an empty list.
13. As a shopper, I want the picker to show me what this Store already knows, so that a product I linked before is one tap away.
14. As a shopper, I want to search the shop for a different term inside the picker, so that a bad grocery name is not a dead end.
15. As a shopper, I want my choice to take effect when I save, so that tapping around in a picker never changes what my household sees.
16. As a shopper, I want to type a price myself for a shop Norish cannot read, so that an unreadable shop costs me a price rather than the feature.
17. As a shopper, I want a price I typed never overwritten by something Norish read, so that my correction is the last word.
18. As a shopper, I want prices to keep themselves current without my asking, so that what I see this week is not last month's number.
19. As a household member, I want a price a housemate just linked to appear on my screen, so that we are looking at one list.
20. As a self-hosting operator, I want this to work without an AI provider configured, so that pricing is not gated behind a paid key.
21. As a self-hosting operator, I want Norish never to hammer a supermarket on my behalf, so that my instance stays a good citizen.

## Implementation Decisions

**Search Address derivation.** The slot is found **structurally, never by recognising words.** Norish is self-hosted in fourteen locales including Bulgarian, Korean and Russian; a shop in Warsaw searches on `szukaj`, one in Lyon on `recherche`, one in Seoul on a word this repo cannot spell. A vocabulary of search words is a list that is wrong everywhere it has not been extended yet, so the derivation does not consult parameter or segment *names* at all.

Given a pasted URL: an existing `{query}` wins outright. Otherwise, if the URL has query parameters, template the one whose **value looks like something a person typed** — sole parameter when there is only one; otherwise the one value that contains Unicode letters, is not purely numeric, is not a locale tag, a boolean, a UUID or a short enum, and is not a repeat of a path segment. Otherwise, if the path's trailing segment passes the same test, template that segment. Otherwise the paste is a plain website and discovery takes over.

Where two values both look like search terms, the better guess goes in the preview and the field stays editable — a ranked guess plus one keystroke, never a wrong answer presented as fact. The "looks typed" test is Unicode-aware (`\p{L}`, not `[a-z]`), or every Cyrillic and Hangul shop fails at the first rung.

**Discovery** is language-neutral in the same way, in three rungs: the `<link rel="search">` OpenSearch descriptor, whose `Url` template names its own `{searchTerms}` slot; then a `<form role="search">`, or any form containing an `<input type="search">`, whose input `name` becomes the slot whatever that name happens to be; then, only as a last resort, a form whose input name or action matches a small search-word vocabulary — and that vocabulary is drawn from the locales Norish ships, not from English and Dutch. Discovery failing is a normal outcome, not an error: the form then asks for a search address in plain words.

**Verification on save.** The probe term is **the user's own**. When the paste contained a real search, we already know a word that shop has results for, so the address is resolved with that word and the candidate count reported. A fixed English probe would report "no products found" against a Polish shop that works perfectly — the probe would be wrong, not the address. When discovery produced the address and no term is known, verification reports that the shop answered rather than inventing a count. The Store saves in every case; verification informs, it does not gate.

**The reader ladder.** One module, two entry points: `readSearchResults(html, baseUrl)` → candidates `{ name, url, price?, currency?, size? }`, and `readProduct(html, url)` → `{ name, price, currency, size? }`. JSON-LD key matching is case-insensitive (Dirk writes `"Price"`). Candidates without a price are dropped before they reach the user, which makes the DOM tier load-bearing rather than decorative. Full rationale and the shop evidence: ADR-0028.

**Fetching.** Plain HTTP fetch with a browser-shaped `User-Agent` first; escalate to Obscura on 403, on a challenge-shaped small body, or on zero candidates. Obscura stays optional for this feature: without it, Dirk-shaped shops work and AH-shaped shops do not.

**Linking.** `(storeId, normalizedName)` is the key, last writer wins, no version guard. A Miss is the same row with no product and a `triedAt`, and carries no reason. Renaming a grocery or moving it to another Store asks a new question rather than carrying the old answer.

**Auto-link rule.** Normalized equality, or containment-plus-uniqueness: every word of the normalized grocery name appears in exactly one candidate's normalized name. No tunable threshold, deliberately — there is no number to re-guess when it misjudges.

**Queue.** One always-on `storeLookup` queue at concurrency 1, pacing store visits inside the processor. Match jobs carry a higher BullMQ priority than refresh jobs. **Never enqueue with `delay`** — that is a lazy-worker trap, and this queue is always-on precisely so the work is predictable.

**Refresh.** A Shelf Price older than 12 hours is refreshed lazily, only for Store Products attached to a Grocery currently on a list, enqueued when the staleness is noticed and capped per page view. There is no scheduled sweep: a self-hosted instance must not visit a supermarket for a list nobody is shopping.

**Manual Store Products.** No page URL, never overwritten, editable by their household. They appear in the picker's "In this store" list like any other product.

**Currency** is read from the page (`priceCurrency`, else the symbol) and falls back to the website's TLD. There is no currency field on the Store.

**Display.** `€2.99 · 150 gram` on the grocery row, size omitted when the shop states none. No age line: at a 12-hour ceiling the age is never interesting, though `pricedAt` is stored for the later expansion.

**Realtime.** Prices push to the household on the existing Store subscription, merged by product id, idempotent like every other subscription handler in the app.

## Testing Decisions

Reader tests run against **committed fixtures of real shop HTML**, already captured under `fixtures/`: `dirk-search-kaas.html` (198-item `ItemList`, prices only in the DOM, scattered `offers` on 32 promo items), `dirk-product-97752.html` (the capital-P `"Price"` trap), and `ah-search-kaas.html` (no JSON-LD at all, 36 product links, prices in `aria-label`). A shop changing its markup then fails a named test instead of quietly returning nothing.

Search Address derivation is pure and gets ordinary unit tests over a table of pasted URLs, including both real shops in both the `{query}` and searched-term forms — and, more importantly, **URL shapes the algorithm has no words for**: a search parameter named in German, French, Polish or Korean, a Cyrillic search term, a term sitting in a trailing path segment, and a URL whose parameters are all ids, pages and locale tags so that nothing should be templated at all. The point of the table is to prove the rule never reads a name.

Browser E2E runs against a **fake shop page served by the harness**, never the real supermarkets: flaky and rude in equal measure. It covers the two paths a user actually walks — a name that auto-links, and a name that opens the picker and is chosen by hand.

## Out of Scope

- Line totals, store totals, and any amount × price arithmetic.
- Comparable unit prices (€/kg) and pack-size conversion, including AH's `UnitPriceSpecification`.
- Sale and discount badges, stock and availability.
- Price history: a Shelf Price is overwritten and the previous one is gone (ADR-0028).
- A store-level "we could not reach this shop" surface in settings.
- `apps/mobile`: web only, groceries only. Prices appear on grocery rows and in the picker, nowhere else.
- Any AI reader. The ladder leaves the seam where one would go.

## Further Notes

- Vocabulary is in `CONTEXT.md` under **Groceries & Stores**: Grocery, Store, Search Address, Store Product, Shelf Price, Product Link, Miss. Use those words in code, tickets and UI copy — in particular, what is displayed is a **Shelf Price**, never a "unit price".
- ADR-0028 records why the reader is a ladder and not a model, and why there is no price history.
- ADR-0019 is untouched: Obscura remains the only rendered-page engine, and a plain fetch renders nothing.
- Docs are already checkpointed at `0.23.0-beta` (`current.label`), so the release notes page for it needs creating in the established structure.
