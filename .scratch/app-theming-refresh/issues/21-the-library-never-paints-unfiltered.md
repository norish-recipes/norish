# 21 — The library never paints unfiltered

**What to build:** A reader who left filters active on the library comes back to a library that already reflects them. Today the stored filters are read asynchronously after mount, so the full unfiltered collection paints first and then visibly re-filters — recipes the reader had filtered away flash into view and disappear.

Filters are the one persisted choice that does not move to a cookie: the stored shape is a structured set of fields and chips, too large and too changeable to ride along on every request. The filters context already exposes a hydration signal that nothing consumes; the library starts consuming it, showing its existing loading presentation until the stored filters have been applied. One frame of skeleton beats a frame of wrong recipes.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] With stored filters, the first painted library is either the loading presentation or the filtered collection — never the unfiltered one.
- [ ] With no stored filters, first paint is not visibly delayed compared to today.
- [ ] Clearing filters and reloading paints the full collection without a filtered intermediate.
- [ ] The filter chips and search fields shown on first paint agree with the collection being shown — controls and results never disagree.
- [ ] Tests cover the hydration gate: a stored filter set never yields an unfiltered render, and an empty one renders straight through.
