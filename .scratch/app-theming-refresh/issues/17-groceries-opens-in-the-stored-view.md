# 17 — Groceries opens in the stored view

**What to build:** The groceries page paints in the reader's stored shape from the very first frame. Both of its device preferences — the store/recipe view mode and the "group similar ingredients" toggle — move from localStorage onto device-preference cookies, so the server renders the page the way the reader left it instead of rendering the default and letting the client swap it after hydration.

Today a reader who works in the recipe view watches the store-grouped list paint first and then the whole list tree swap, and a reader who turned grouping off watches merged rows split apart a frame in. After this ticket neither swap exists: the HTML the server sends already carries the stored view and grouping.

**Blocked by:** 16 (one helper for device-preference cookies).

**Status:** ready-for-agent

- [ ] With the recipe view stored, the HTML the server sends for groceries is the recipe-grouped list; the store view never appears, not even for a frame.
- [ ] With grouping turned off, grocery rows render ungrouped from the first frame; rows never merge and then split.
- [ ] Toggling either preference updates the page immediately and survives a reload and a full restart of the browser.
- [ ] A navigation answered by the service worker's cached HTML, and the offline bootstrap, both end up showing the cookie's current choice.
- [ ] As with the library's migration, there is deliberately no fallback read of the old localStorage keys: a reader who had switched views picks their view once more and it sticks.
- [ ] Page-level tests assert the server-rendered markup for a request carrying each cookie value, and the existing groceries suites keep passing.
