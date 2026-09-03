# 07 — A Product Lookup prices new groceries quietly

**What to build:** The automatic path. Whenever groceries land in a store that has a **Product Search** and no remembered product for their name, a **Product Lookup** runs in the background: one job per store, walking every waiting name through the store's search one visit at a time with a pause between them, and linking the first candidate whose name contains the grocery's normalised name whole. Candidates that did not match are kept as products with origin "lookup" for the picker. The picker also gains its own **search the store** door for a person, using the same search-and-read. Names are searched once and remembered, so a recipe's add-all is a handful of visits the first week and none the next. Adding the same items one by one joins one walk.

**Blocked by:** 05 — a lookup needs a Product Search to search.

**Status:** ready-for-agent

- [ ] A lookup queue exists with one job per store, a deterministic job id so repeated triggers coalesce, and a worker that runs one job at a time
- [ ] Triggers: groceries created into a store (including the recipe panel's add-all and Store Preference assignment), a grocery moved into a store, a store gaining a Product Search, and the store's manual refresh action; triggers debounce briefly so items added one by one share a walk; nothing is queued when the switch is off or the store has no Product Search
- [ ] The job gathers every undone grocery in the store whose normalised name has no link and was not attempted in the last day, and visits the store's search for each in turn with a fixed pause
- [ ] Without AI the search term is the normalised name; a candidate is linked only when its name contains the normalised name whole with word boundaries respected, the store's first such result winning; otherwise the readings are stored as lookup candidates and the grocery stays Unpriced
- [ ] A link a lookup made is marked as not chosen by a person; a link a person chose is never revisited by a lookup
- [ ] The picker offers "search the store" for a person, which runs the same search-and-read on demand and lists the readings to choose from; with the switch off the door explains why it is unavailable
- [ ] The picker lists lookup candidates after linked and by-hand products; the daily cleanup sweeps lookup candidates nothing has linked within thirty days
- [ ] Worker tests with the fetch and reader mocked prove the walk order, the pause, the whole-name rule, the never-revisit rule, the once-a-day skip and the switch gate; a router test proves the person's search door
