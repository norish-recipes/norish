# 04 — The Price Visit switch, the store page reader, and a pasted product page

**What to build:** Norish reads its first price from a store's site. An administrator switch, **Price Visits**, off by default, allows or forbids every visit Norish makes to a retailer (ADR-0029). The **store page reader** turns a rendered page's HTML into product readings, name, page, price, currency and regular price, from schema.org Product data alone, with no AI and no browser. A **Price Visit** entry point checks the switch, gathers the household's Site Auth Tokens for the page's domain, fetches the page through the existing rendered-page fetch and runs the reader. Its first consumer is the picker's **paste a product page** door: with the switch on, pasting a product address creates a Store Product with the store's price and links the grocery; with the switch off, the door explains that visits are off.

**Blocked by:** 02 — a reading needs a product to become.

**Status:** ready-for-agent

- [ ] A database-backed admin setting "Price Visits" exists, default off, shown in the general settings card, with an accessor every visit consults first; an upgrade leaves it off
- [ ] The store page reader is a pure function: HTML and its address in, zero or more product readings out; it reads Product JSON-LD and microdata, product lists on results pages, and strikethrough or list-price specifications as the regular price; a price without a currency yields nothing rather than a guess
- [ ] Fixture pages prove the reader on: a product page with an offer, the same with a struck-through list price, microdata only, a results page with an ItemList, a recipe page (nothing), a page with a price and no currency (nothing), and a Dutch page
- [ ] The recipe JSON-LD extractor's generic HTML and node handling is factored out first so the reader shares it, as its own commit
- [ ] The Price Visit entry point refuses with a distinct, client-nameable error when the switch is off; otherwise it gathers Site Auth Tokens for the domain, the asking person's own first and one member's at random among those who hold any, and reuses the import path's isolated context
- [ ] Pasting a product page in the picker with the switch on creates a Store Product with origin "page", the Store Price, currency, regular price when stated and read-at, and links the grocery; the same page pasted twice for the same store reuses the product
- [ ] With the switch off, the paste door shows a one-line notice that the administrator has not allowed visits; the store manager shows the same notice beside Product Search
- [ ] The admin-settings configuration page documents the switch
- [ ] Router tests cover the refusal and the token choice; reader tests cover the fixtures; the fetch is never called in tests
