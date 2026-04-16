## 1. Prefetch Budget Tracker

- [x] 1.1 Create `apps/mobile/src/lib/query-cache/prefetch-budget.ts` — a module-scoped ordered set (array) tracking prefetched recipe IDs, with `add(id)`, `evict(queryClient)`, and `has(id)` helpers. Export `MAX_PREFETCHED_RECIPES = 30` constant.
- [x] 1.2 Add unit tests for the budget tracker: verify LRU eviction order, that the budget caps at 30, and that `has()` correctly identifies tracked IDs.

## 2. Core Prefetch Hook

- [x] 2.1 Create `apps/mobile/src/hooks/recipes/use-recipe-prefetch.ts` — accepts a `viewableItems` array (from `FlatList.onViewableItemsChanged`), debounces by 300 ms, calls `queryClient.prefetchQuery(trpc.recipes.get.queryOptions({ id }))` for each visible recipe that is not already cached, tracks prefetched IDs via the budget tracker, and evicts oldest when budget is exceeded. Failures are silent with one retry after 1 s.
- [x] 2.2 Create `apps/mobile/src/hooks/recipes/use-viewability-config.ts` — exports a stable `viewabilityConfig` object (e.g. `{ itemVisiblePercentThreshold: 50 }`) and a `useRef`-based `onViewableItemsChanged` callback ref for use with `FlatList`.

## 3. Dashboard Integration

- [x] 3.1 Wire `onViewableItemsChanged` and `viewabilityConfig` into the dashboard `FlatList` in `apps/mobile/src/app/(tabs)/dashboard/index.tsx`. Pass viewable recipe IDs into `useRecipePrefetch`.
- [ ] 3.2 Verify on device: scroll the dashboard, tap a recipe card, confirm instant detail load from cache (no loading spinner).

## 4. Search Screen Integration

- [x] 4.1 Wire `onViewableItemsChanged` and `viewabilityConfig` into the search results `FlatList` in `apps/mobile/src/app/(tabs)/search/index.tsx`. Pass viewable recipe IDs into `useRecipePrefetch`.
- [ ] 4.2 Verify on device: search for recipes, scroll results, tap a card, confirm instant load.

## 5. Cache Budget Enforcement

- [ ] 5.1 Verify that after scrolling through >30 recipes on the dashboard, the in-memory query cache contains at most 30 prefetched `recipes.get` entries (plus any naturally-fetched ones). Add a debug log that reports the current prefetch count when eviction occurs.
- [ ] 5.2 Verify that naturally-fetched recipes (loaded via recipe detail navigation) are not evicted by the prefetch budget.

## 6. Smoke Test & Cleanup

- [ ] 6.1 Kill and cold-start the app after prefetching — confirm persisted cache restores correctly and previously-prefetched recipes are available offline.
- [ ] 6.2 Confirm no regressions: pull-to-refresh, infinite scroll pagination, and recipe subscriptions still work correctly on dashboard and search.
