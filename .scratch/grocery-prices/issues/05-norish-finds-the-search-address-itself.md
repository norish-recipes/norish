# 05 — Norish finds the search address itself

**What to build:** Saving a **Store Website** with Price Visits on starts a **discovery** in the background: one visit to the site that looks for an OpenSearch description, then a search form with a single text field, then the site's own search link, and writes what it finds into the **Product Search** with the placeholder in place. The store manager shows the discovery state, searching, found, not found, live, and a person may overwrite the result at any time. With the switch off, nothing is queued and the manager says so.

**Blocked by:** 01 — the fields; 04 — the visit and the switch.

**Status:** ready-for-agent

- [ ] A store carries a discovery state: none, searching, found, not found; it is announced with the store's realtime update
- [ ] Saving or changing a website with the switch on queues one discovery job per store, coalescing repeats; with the switch off nothing is queued and the state stays none
- [ ] Discovery reads the site's declared language and keeps it on the store for later use by the AI search term
- [ ] The discovery worker tries, in order, an OpenSearch description, a form whose action takes exactly one text input, and a link whose text or rel names search, and writes the first address that yields a template with the placeholder
- [ ] A Product Search a person typed is never overwritten by discovery; discovery only fills an empty field
- [ ] The store manager shows the state beside the search field while it changes, and "not found" invites the paste-a-search conversion from 01
- [ ] Worker tests prove the three strategies on fixture pages and the never-overwrite rule with the fetch mocked; a router test proves the switch gate
