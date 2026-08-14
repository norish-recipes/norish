# 21 — The library never paints unfiltered

**What to build:** A reader who left filters active on the library comes back to a library that already reflects them. Today the stored filters are read asynchronously after mount, so the full unfiltered collection paints first and then visibly re-filters — recipes the reader had filtered away flash into view and disappear.

Filters are the one persisted choice that does not move to a cookie: the stored shape is a structured set of fields and chips, too large and too changeable to ride along on every request. The filters context already exposes a hydration signal that nothing consumes; the library starts consuming it, showing its existing loading presentation until the stored filters have been applied. One frame of skeleton beats a frame of wrong recipes.

**Blocked by:** None — can start immediately.

**Status:** done

- [x] With stored filters, the first painted library is either the loading presentation or the filtered collection — never the unfiltered one.
- [x] With no stored filters, first paint is not visibly delayed compared to today.
- [x] Clearing filters and reloading paints the full collection without a filtered intermediate.
- [x] The filter chips and search fields shown on first paint agree with the collection being shown — controls and results never disagree.
- [x] Tests cover the hydration gate: a stored filter set never yields an unfiltered render, and an empty one renders straight through.

## Comments

- Shipped in the shared recipes context, so web and mobile get the same gate. `RecipesProvider` now consumes the filters context's `isHydrated` signal two ways: the recipes query gains an `enabled` option and stays off until hydration (no wasted unfiltered fetch), and the context's `isLoading` holds true until hydration regardless of what the query reports — necessary because the persisted query cache can answer the default-filters key instantly, so gating only the fetch would still paint cached unfiltered recipes. The library's existing skeleton (recipe-grid seeds `showSkeleton` from `isLoading`) is the loading presentation, unchanged. With nothing stored, the provider hydrates on the first effect pass (a localStorage read), well inside the network fetch that gates first paint today; clearing filters removes the stored entry so a reload renders straight through. The panel's chips read the same filters state, so once a collection paints it is always the one the visible controls describe. `recipes-context-hydration.test.tsx` covers the held skeleton, the release with stored filters applied, and the straight-through path.
