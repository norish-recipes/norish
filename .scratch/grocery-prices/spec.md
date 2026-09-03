# Grocery prices

Status: ready-for-agent

Glossary: `CONTEXT.md`, section "Groceries & Stores". Decisions: ADR-0028 (a grocery is priced only through a Store Product), ADR-0029 (one switch gates every Price Visit, and a visit borrows any member's login). Use the glossary's words throughout: Store, Store Website, Product Search, Store Product, Product Link, Product Lookup, Price Visit, Store Price, Set Price, Sale, Price Refresh, Pack Count, Trip Total, Open Total, Unpriced, Unsorted, Store Preference.

## Problem Statement

A Store in Norish is a label. It sorts the grocery list into the trips a household will make, and a Store Preference quietly learns which store each ingredient goes to, but nothing about a store connects it to the shop it is named after. The list therefore answers "what do I need" and "where do I get it" and has never answered the question that follows on the way out of the door: "what is this going to cost".

The pieces to answer it are all missing at once. There is no money anywhere in the product, no notion of a specific item a store sells, and no way to say that "milk", "melk" and "halfvolle melk" are the same carton. A household whose recipes come in two languages, shopping at a Dutch supermarket, has no way to even start.

At the same time the groceries feature has never had a documentation page. A store, the Unsorted bucket and the Store Preference are undocumented today, so anything built on them would be explaining them from scratch in its first paragraph.

## Solution

A store gains a **Store Website**, and from it a **Product Search**, the address at which the site answers a search with a place for the term. Norish tries to discover the search address from the website on its own and a person can correct it, including by pasting the address of a search they just did on the site.

A price lives only on a **Store Product**: one specific item a store sells, with its name in the store's own words, its price in whatever currency the store advertises, and, when it came from the site, the page it lives on. A grocery is priced by a **Product Link**, one per store and normalised name for the whole household, so the next "melk" bound for that store is priced without anyone asking. The grocery line itself stays what it is: a name, an amount, a unit. Its row shows the linked product's name and price beneath it, so a shopper reading "milk" in an English recipe sees "AH Halfvolle melk 1 L, €1.29" in the aisle.

Links come from three places. A person chooses one in a **product picker** reached from the grocery's edit panel: products the store already knows, a search of the store's site, a pasted product page, or a product made by hand with just a name and a price. A **Product Lookup** finds them quietly in the background whenever groceries land in a searchable store with no remembered product, walking every waiting name for that store through one paced browser session rather than a burst, and linking a candidate only when its name is a close enough match. And a link, once made, is remembered.

Prices come from the store and from people. The **Store Price** is what the product's page states, re-read by a daily **Price Refresh** for every product an undone grocery points at, and on demand from a refresh action on the store. A **Set Price** is what a person typed, and it wins until they clear it. A **Sale** is entirely the store's claim: a page stating a regular price beside a lower current one, shown as a badge with the regular price struck through, gone the first refresh that no longer sees it.

Every store header carries its **Open Total**, the cost of what is still to get, with an **Unpriced** count beside it so the number is honest about what it leaves out. The page carries the **Trip Total** and the Open Total side by side. A grocery costs its product's price times its **Pack Count**, one unless a person says otherwise; nothing is ever derived from the recipe amount.

All of it works without AI: Norish reads what a store's pages state outright in their structured product data, which is how product pages and most search result pages are marked up for the shopping search engines. AI, when the instance has it, only extends the lookup to pages that state nothing plainly and to searching in the store's own language for a name written in another one.

Every visit Norish makes to a store's site is a **Price Visit**, and one administrator switch, off by default, allows or forbids all of them. With it off, every product is made by hand and every price is a Set Price, and totals work exactly the same. A visit carries the Site Auth Tokens any household member holds for the store's domain, so a store that prices its shelves behind a login is read as a member sees it.

Prices, products and links ride in the offline Warm Set with the list, so the total and the badges read in an aisle with no signal. The web app on a phone is the mobile experience; the store manager and every panel here are the shared ones. The docs gain a Groceries section covering the list, stores and prices.

## User Stories

1. As a cook, I want to see what my grocery trip will cost before I leave, so that I can decide whether this week's plan fits.
2. As a cook, I want each store's section to show what is still to get in money, so that in the aisle I know what is left.
3. As a cook, I want the list to show both the whole trip's cost and what is still open, so that ticking items off tells me how far along I am.
4. As a cook, I want an unpriced count beside every total, so that I know how much the number leaves out and whether to trust it.
5. As a cook, I want a store to link to the real shop's website, so that a store stands for a place rather than a label.
6. As a cook, I want Norish to work out the site's search address for me when I add a website, so that I do not have to know how the site is built.
7. As a cook, I want to correct the search address by pasting the address of a search I just did on the site, so that a store Norish could not work out still becomes searchable.
8. As a cook, I want the store manager to tell me whether a store can be searched, so that I know what to expect from the lookup.
9. As a cook, I want an "open website" link on a store, so that I can get to the shop's site from the list.
10. As a cook, I want a grocery to show the product it is linked to, with the store's own name for it and its price, so that in the aisle I read what to grab.
11. As a cook, I want to link a grocery to the right product myself, so that a wrong or missing link is one tap to fix.
12. As a cook, I want the picker to offer products the store already knows, so that linking is usually a choice rather than a search.
13. As a cook, I want to search the store's site from the picker, so that I can find a product without leaving Norish.
14. As a cook, I want to paste a product page's address into the picker, so that a product I found in the store's own app becomes a priced product here.
15. As a cook, I want to make a product by hand with just a name and a price, so that a market stall or a shop with no website can still be priced.
16. As a cook, I want Norish to find products for new groceries on its own, so that most of the list is priced before I have done anything.
17. As a cook, I want Norish to only link a product on its own when the names clearly match, so that the total is not padded with wrong guesses.
18. As a cook, I want a grocery Norish could not place to stay unpriced with the candidates it found waiting in the picker, so that the work it did is not thrown away.
19. As a cook, I want "milk", "melk" and "halfvolle melk" to be able to point at the same product, so that recipes in two languages do not mean two prices.
20. As a cook, I want a link to be remembered for the next time that name lands in that store, so that a product is chosen once and priced forever.
21. As a cook, I want a product I chose by hand never to be overridden by an automatic lookup, so that my correction sticks.
22. As a cook, I want to set a price on a product myself, so that a member price or a wrong figure on the site does not spoil the total.
23. As a cook, I want my set price to win until I clear it, and clearing it to land on the store's latest figure, so that a correction is reversible without retyping anything.
24. As a cook, I want to see the store's figure beside my set price, so that I notice when the two drift apart.
25. As a cook, I want a sale badge when the store says a product is on offer, with the regular price struck through, so that I can see the saving at a glance.
26. As a cook, I want a sale to disappear when the store stops advertising it, so that the badge never lies.
27. As a cook, I want prices re-read daily for the things on my list, so that the total is about this week's prices, not last month's.
28. As a cook, I want a refresh action on a store, so that I can get today's prices right now.
29. As a cook, I want a price to say how old it is when it is older than a day, so that a failed refresh shows as staleness rather than silence.
30. As a cook, I want a product whose page has vanished to keep its last price and say so, so that a retailer's redesign does not empty my total overnight.
31. As a cook, I want each grocery to count as one pack unless I say otherwise, so that "500 g flour" costs one bag rather than half of one.
32. As a cook, I want to set how many packs a grocery buys, so that a big batch is priced right.
33. As a cook, I want a grouped row to cost its packs once, so that three recipes' flour is one bag in the total.
34. As a cook, I want choosing a product on a grouped row to link every name in the group, so that I do not repeat the choice per recipe.
35. As a cook, I want a grocery in Unsorted to simply show as unpriced, so that the list does not pretend to know a price with no store to ask.
36. As a cook, I want moving a grocery to another store to re-price it under that store's products, so that the total follows the trip I will actually make.
37. As a cook, I want prices shown in the currency the store advertises, formatted for my language, so that a Dutch store reads "€ 1,29" and a British one "£1.29".
38. As a cook, I want a product priced in a currency different from its store's others to show as unpriced with a reason, so that a total never adds apples to dollars.
39. As a cook, I want the list, its prices, sale badges and totals to read offline, so that the aisle with no signal is still the place this is most useful.
40. As a cook, I want setting a price or a pack count offline to apply when I am back online, so that a correction made in the aisle is not lost.
41. As a cook, I want search, paste and refresh to be visibly unavailable offline rather than failing, so that I know why they do nothing.
42. As a cook, I want all of this on my phone in the web app, so that the store manager and picker I use on the desktop are the ones I use in the aisle.
43. As a household member, I want the product chosen for "melk" at our store to be the one everybody sees, so that we all read the same list and the same total.
44. As a household member, I want a store's products to be visible to everyone who sees the store, so that a product one of us made by hand prices the other's grocery too.
45. As a household member, I want the last person to choose a product to have chosen it for everyone, so that a disagreement is settled by the most recent decision rather than modelled.
46. As a household member, I want a store that prices its shelves behind a login to be read through whichever of us has saved a login for it, so that member pricing works for the household.
47. As a household member, I want removing my saved login for a site to stop it being used at once, so that I stay in control of it.
48. As an administrator, I want one switch that allows or forbids every visit Norish makes to a retailer, off by default, so that an upgrade never starts my server browsing supermarkets on its own.
49. As an administrator, I want the store manager to say that lookups are off when I have not switched them on, so that my household does not report a broken feature.
50. As an administrator, I want prices by hand to work fully with the switch off, so that forbidding visits does not forbid the feature.
51. As an administrator, I want visits to any one site to happen one at a time with a pause between them, so that my server is never mistaken for a scraper.
52. As an administrator, I want the two AI prompts this adds to be editable like every other prompt, so that a store in an unusual language or layout can be tuned without a release.
53. As an administrator, I want the lookup to run without AI, so that an instance with no AI provider still prices its groceries.
54. As an administrator, I want the switch documented on the admin settings page and called out in the upgrade notes, so that I learn about it before the release rather than after.
55. As a reader of the docs, I want a Groceries section that explains the list, stores, the Store Preference and prices, so that the feature I am using has somewhere to be read about.
56. As a reader of the docs, I want the release notes to tell me what changed in plain product language, so that I can decide whether to look at it.

## Implementation Decisions

### Stores gain a website and a search

- The store gains two optional fields, the Store Website and the Product Search. The Product Search is stored as an address with a `{query}` placeholder. The store manager panel shows both under the existing name, colour and icon fields, with the shared Panel so phone and desktop are the same surface.
- Saving a Store Website with the Price Visit switch on queues a **discovery**: a background Price Visit to the site that looks, in order, for an OpenSearch description, for a form whose action takes a single text input, and for the site's own search link. A found address is written into the Product Search with the placeholder in place. The store carries a discovery state (none, searching, found, not found) so the manager can say which it is, and the state is announced to the household over the existing store realtime channel as a store update.
- A person may type or paste a Product Search at any time, switch on or off; typing is not a visit. Pasting a results-page address without a placeholder converts it: Norish recognises the search parameter by its common names (and otherwise takes the single parameter whose value is a word), replaces its value with `{query}`, and shows the converted address before it is saved.
- Store name uniqueness, versioning, reorder and delete are unchanged. Deleting a store deletes its products and links with it.

### Store Products and Product Links

- A new **store products** table: id, store, name, page address (nullable), Store Price (nullable), currency, regular price (nullable, present only while the store states a Sale), read-at moment, Set Price (nullable), origin (by hand, page, lookup), version. A product's page address is unique per store.
- A new **product links** table: id, store, normalised name, product, chosen-by-person flag, version, unique per store and normalised name. The normalisation is the same function the Store Preference already uses, so both memories agree on the name.
- The grocery gains a **Pack Count**, an integer defaulting to one. It is the only price-related field on a grocery.
- Nothing stores a total. Totals are derived at read time on the client from groceries, links and products by one pure function in the shared package, beside the existing grocery grouping helper, so the store header, the page header and the grouped view all call the same arithmetic.
- Product candidates a lookup found but did not link are kept as Store Products with origin "lookup" and no link. The picker lists linked and by-hand products first, then lookup candidates. Lookup candidates nothing has linked within thirty days are swept by the existing daily cleanup job.
- A Set Price is a field on the product, not a separate record; clearing it sets the field to null. The Store Price and its read-at moment are updated by every successful read regardless of whether a Set Price exists.
- Currency is a field on the product, taken from the page. A by-hand product takes the currency the store's other products advertise, else the currency implied by the instance's default locale, else none, in which case the price entry asks for one.

### The Price Visit and its readers

- One server-side entry point, the **store page reader**, takes a rendered page's HTML and its address and returns zero or more product readings: name, page address, price, currency, regular price when stated, and nothing else. It reads schema.org Product data in JSON-LD and microdata, including product lists on results pages and strikethrough or list-price specifications for the regular price, and it is pure: no browser, no AI, no database. It sits beside the recipe JSON-LD extractor in the parser package and shares its HTML handling.
- The rendered HTML comes from the existing rendered-page fetch through Obscura, unchanged. Discovery, lookup, refresh and paste all go through that one fetch; there is no second HTTP client.
- An **AI page reader** with the same output shape covers pages the structured reader finds nothing on. It is a new structured request shape, "product reading", following the enrichment checklist: a shipped prompt default, a strict output schema, a code-owned system message, a prompt field in the admin prompts form, and the retired-defaults regeneration. It runs only when AI is enabled and only after the structured reader returned nothing.
- A second request shape, "product search term", turns a grocery name into the term a shopper would type into the store's search box in the store's language, given the site's declared language and host. It runs only on the AI path and only when the site's declared language differs from the name's apparent one; otherwise the term is the normalised name.
- The household's Site Auth Tokens for the store's domain are gathered once per visit: the asking person's first when there is one, otherwise one member chosen at random among those who hold any for the domain. Decryption and injection reuse the import path's isolated context exactly (ADR-0029).
- Every visit checks the Price Visit switch first and refuses when it is off, with a distinct error the client can name. Discovery, lookup and refresh jobs are not even queued when it is off.

### Product Lookup and Price Refresh as queue work

- A **product lookup queue** with one job per store, deterministic job id per store so repeated triggers coalesce. The job gathers every undone grocery in that store whose normalised name has no link, searches each name in turn through the store's Product Search with a fixed pause between visits, links the first candidate whose name contains the grocery's normalised name whole (word boundaries respected) or, on the AI path, the candidate the model names, and stores the rest as lookup candidates. Names that were linked or attempted in the last day are skipped.
- Triggers: groceries created into a store (including the recipe panel's add-all and Store Preference assignment), a grocery moved into a store, a store gaining a Product Search, and the store's manual refresh action. Triggers debounce briefly so items added one by one join one walk.
- A **price refresh queue** with one job per store, run by the always-on scheduled-tasks worker once a day and spread across a window rather than fired at once. It re-reads every product linked from an undone grocery whose read-at is older than a day, one page at a time with the same pause. The store's manual refresh action queues the same job immediately. A read that fails leaves the product untouched; the age shown is what tells the reader.
- Both workers run one job at a time. That serialises visits across the whole instance, which is more conservative than the per-domain promise and deliberately simpler than a per-domain lock.
- Lookup and refresh workers follow the lazy-worker pattern and hold no database handle beyond the repository calls they make. They are not Recipe Enrichment kinds: they do not join the enrichment coordinator, producer or announce machinery, because their subject is a store rather than a recipe.

### Router, realtime and client

- Store procedures gain: update website and search (with the paste conversion done client-side and validated server-side), request discovery, request refresh, list products for the household's stores, create a by-hand product, set and clear a Set Price, delete a product, choose a link, unlink, and set a Pack Count on a grocery. All are household-guarded and version-guarded like the existing store and grocery procedures.
- Two new events on the store realtime channel: products changed for a store (the changed products) and links changed for a store (the changed links). Grocery pack-count changes ride the existing grocery updated event. Echo suppression follows the existing store and grocery rule: a client that already applied its own change ignores its echo.
- The shared client hooks for stores gain a products query, a links query, their cache updaters and their subscription. The groceries page derives totals through the shared pure function and passes them to the store section header and the page header.
- The grocery row shows, when linked, the product name as a second line, the price at the trailing edge, a sale badge with the struck-through regular price, and an ageing note when the read is older than a day. The edit panel gains a "Product" field opening the picker, a Pack Count stepper, and the Set Price and clear controls for the linked product. The store section header gains the Open Total and Unpriced count and a refresh action beside the existing bulk actions. The store manager gains the website and search fields, the discovery state, and, when the switch is off, a one-line notice.
- Currency is formatted with the platform's number formatter in the reader's locale and the product's currency.

### Offline

- The products and links queries join the Warm Set beside the groceries and stores lists, so a warmed list prices offline.
- Set Price, clear Set Price, Pack Count, choose link, unlink and by-hand product creation are Outbox-eligible with Client-Minted Ids (ADR-0003) and first-writer-wins on Replay (ADR-0004). Discovery, search, paste and refresh require Live and their controls carry the standard offline disabled state.

### Configuration and administration

- One new admin setting, the Price Visit switch, in the general settings card, default off, documented on the admin-settings configuration page. It is a database-backed setting, not an environment variable, so it needs no restart and no `.env.example` change.
- The two new prompts appear in the prompts form like the existing eleven.

### Internationalisation and docs

- All new strings live in the groceries namespace across every locale. The Unsorted label, the "auto-detect" copy and the by-hand product flow reuse existing keys where they fit.
- A new docs section, Groceries, with three pages: the list (adding, recipes, recurring, grouping, Unsorted), stores (the store manager, the Store Preference, website and search), and prices (products, links, the picker, Set Price, sales, totals, the switch). Screenshots per the feature-docs rule. A release-notes section on the Target Version's page.

## Testing Decisions

A good test here exercises behaviour a person or an operator can observe, at the widest boundary that can be driven without a live retailer. It never asserts on how a page was parsed or which repository call ran, only on what came out.

**Seams, highest first. The first two carry the feature; the rest already exist.**

1. **The store page reader.** HTML plus an address in, product readings out. Fixture pages cover: a product page with Product JSON-LD and an offer; the same with a strikethrough list price (a Sale); microdata instead of JSON-LD; a results page with an ItemList of products; a page with a recipe but no product (nothing); a page with a price and no currency (nothing, never a guess); a page in Dutch. Prior art: the parser package's extraction and normaliser tests, which already feed fixture HTML through pure functions.
2. **The store and grocery routers.** Vitest against the procedures with the repositories and emitters mocked, as the existing store and grocery router tests do: household guard, version guard, the switch refusing a visit, discovery and refresh being queued or not, link choose and unlink updating the household's one link, Set Price precedence over Store Price in what is returned, Pack Count bounds, and the events emitted. Prior art: `stores.test.ts` and `groceries.test.ts` in the tRPC package.
3. **The lookup and refresh workers.** Vitest with the page fetch and the reader mocked, asserting the walk: names without a link are visited one at a time in order, a whole-name match links, a partial match stores candidates and links nothing, the AI reader is consulted only when the structured reader returned nothing and only with AI enabled, tokens are chosen as ADR-0029 says, and a refresh skips products read within a day and leaves a failed product untouched. Prior art: the ingredient-linking worker test and the enrichment coordinator tests in the queue package.
4. **The totals function.** Vitest in the shared package: Open Total and Trip Total per store and overall, Unpriced counting, Pack Count multiplication, grouped rows costing their packs once, a mixed-currency product excluded with a count, Unsorted always Unpriced. Prior art: the grocery-grouping tests.
5. **The AI request shapes.** The prompt tests for shipped defaults and retired defaults extend to the two new prompts; the readers' feature tests mock the runtime as the enrichment features do.
6. **Browser E2E.** The production-like harness runs no Obscura, so nothing here drives a Price Visit end to end; that is what seams 1 and 3 are for. E2E covers everything a person can do with the switch off and on without a visit: the store manager's new fields and the switch-off notice, a by-hand product with a Set Price and a Pack Count pricing a row, the store header's Open Total and Unpriced count moving as items are ticked, the page's two totals, and, in the offline project, a warmed list showing prices and a sale badge with the backend stopped and a Set Price made offline replaying. Prior art: the cookbooks E2E and the offline fixture's seeded grocery.

The repository layer gets database tests only for the two new tables' invariants: one link per store and name, one page per store, cascade on store delete, and the thirty-day candidate sweep. Prior art: the recurring-groceries repository test.

## Out of Scope

- Comparing prices across stores, or steering a grocery to the cheapest store. A grocery has one store and at most one product (ADR-0028).
- Package arithmetic: deriving a Pack Count from the recipe amount and the product's package size. A later enrichment kind may set a count when it is sure; nothing here does.
- Price history, price trends, or "went up since last week".
- A manual sale flag, sale end dates, or inferred sales.
- Per-store, per-household or "manual visits only" variants of the switch (ADR-0029).
- Retailer-specific adapters or APIs. Every store is read through its own pages and nothing else.
- Online ordering, carts, or deep links into a retailer's app.
- Per-recipe costs in the by-recipe view.
- Barcode or EAN scanning.
- The Expo app. It keeps its plain rows until store management exists there.
- Public OpenAPI endpoints for products and links.
- Any change to how the Store Preference works or is surfaced.

## Further Notes

- The docs' editable Target Version is still 0.22.0-beta while this branch is rc/0.23.0-beta; the 0.22.0 checkpoint has not been run. The release-notes section goes on whichever page is the Target Version when the work lands.
- Nothing money-shaped existed before this: no price, currency, product, sale or barcode concept anywhere in packages, the web app or the docs. Every contract, table, key and page here is new.
- The E2E harness proves imports through paste, not through Obscura, and the same limit applies here. Adding a fake store site to the harness would also need a fake Obscura; that is a harness feature, not part of this spec.
- Site Auth Tokens already rotate across a member's accounts for imports. The random choice among members here is a second layer above that rotation, not a replacement for it.
- The "close enough match" rule without AI is deliberately strict and explainable: the grocery's normalised name must appear whole in the candidate's name. Loosening it is a product decision, not a tuning knob, because every loosening pads totals with guesses.
- Two glossary terms describe existing behaviour that had no name until now, Unsorted and Store Preference. The docs should use them.
