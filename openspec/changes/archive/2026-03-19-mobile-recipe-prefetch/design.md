## Context

On web, `useRecipePrefetch` attaches an `IntersectionObserver` to each recipe card's wrapper `div`. When the card enters the viewport (with a 200 px root margin), it calls `queryClient.prefetchQuery(trpc.recipes.get.queryOptions({ id }))`, populating the TanStack Query cache with the full recipe. This means navigating to the recipe detail page resolves instantly from cache.

On mobile, the dashboard and search screens render recipes in a `FlatList`. React Native has no `IntersectionObserver`, but `FlatList` exposes `onViewableItemsChanged` — a performant, native-driven callback that reports which items are currently visible. The existing TanStack Query cache is already persisted to a dedicated MMKV instance (`norish-query-cache`) using `@tanstack/query-persist-client-core`. There is no cap on how much data accumulates in that MMKV blob.

## Goals / Non-Goals

**Goals:**

- Prefetch `recipes.get` for recipe cards currently visible on the dashboard and search `FlatList` screens so recipe detail opens from cache.
- Bound the number of prefetched full-recipe entries persisted to MMKV to limit device storage and startup restore time.
- Keep the implementation simple, mobile-only, and non-disruptive to existing cache persistence.

**Non-Goals:**

- Sharing a single cross-platform abstraction with web. The web hook uses DOM-specific `IntersectionObserver`; the mobile hook uses RN-specific `FlatList.onViewableItemsChanged`. A shared contract adds complexity for minimal gain — they can converge later if needed.
- Prefetching images or media — only the recipe data object is prefetched.
- Evicting non-prefetch queries (dashboard list, favorites, etc.) — the budget only applies to individually-prefetched `recipes.get` entries.

## Decisions

### 1. Use `FlatList.onViewableItemsChanged` for viewability tracking

**Choice**: Hook into `onViewableItemsChanged` + `viewabilityConfig` on the existing dashboard and search `FlatList` instances.

**Rationale**: This is the idiomatic React Native mechanism for viewability. It is driven by the native scroll engine and is more efficient than mounting per-item `useEffect` hooks or polling scroll position. The callback receives an array of `viewableItems` which can be mapped to recipe IDs.

**Alternative considered**: Per-item approach using `react-native-intersection-observer` or a custom `useOnScreen` hook — rejected because it would add a dependency and per-item observer overhead in a virtualized list where items mount/unmount frequently.

### 2. Mobile-only hook in `apps/mobile`, not `shared-react`

**Choice**: Place the hook at `apps/mobile/src/hooks/recipes/use-recipe-prefetch.ts`.

**Rationale**: The hook depends on `FlatList` viewability callbacks which are React Native–specific. The web hook lives at `apps/web/hooks/recipes/use-recipe-prefetch.ts` and depends on `IntersectionObserver`. There is no shared surface to abstract over without introducing a factory pattern that adds complexity for two inherently platform-specific implementations.

### 3. Prefetch budget with LRU eviction

**Choice**: Maintain a constant `MAX_PREFETCHED_RECIPES` (default 30). Track prefetched recipe IDs in a module-scoped ordered set (simple array). When a new prefetch would exceed the budget, remove the oldest entry from the TanStack Query cache via `queryClient.removeQueries({ queryKey })`.

**Rationale**: 30 full recipe objects is a reasonable upper bound — enough to cover a full scroll session but small enough to keep the serialized MMKV blob bounded. LRU eviction (remove oldest first) is simple, predictable, and matches the user's access pattern (recently viewed recipes are most likely to be accessed next).

**Alternative considered**: Using `shouldDehydrateQuery` to filter at persist time — rejected because it only prevents persistence, not in-memory accumulation. Queries would still pile up in the in-memory QueryClient during a long scroll session. Active eviction keeps both in sync.

### 4. Debounce prefetch calls

**Choice**: Debounce the `onViewableItemsChanged` handler by ~300 ms to avoid firing prefetch requests during rapid scrolling.

**Rationale**: `onViewableItemsChanged` fires frequently during fast flings. Debouncing avoids queueing fetches for items that scroll past before the user settles. The web hook gets this for free from `IntersectionObserver`'s asynchronous nature plus the `rootMargin` buffer.

### 5. Skip already-cached recipes

**Choice**: Before calling `queryClient.prefetchQuery`, check `queryClient.getQueryData(queryKey)`. Skip if data already exists and is not stale.

**Rationale**: Avoids redundant network requests for recipes that were already prefetched or fetched normally (e.g. user already visited the recipe detail page). `prefetchQuery` already does this internally, but the explicit check also lets us skip the budget tracking bookkeeping.

## Risks / Trade-offs

- **[Network burst on large scroll]** → Mitigated by the debounce and by `prefetchQuery`'s internal deduplication. Additionally, TanStack Query's `staleTime` (5 min) prevents re-fetching recently-prefetched entries.
- **[Budget too small / too large]** → 30 is a sensible default; it can be tuned via a named constant without code changes. If needed, it could later be exposed as a user preference.
- **[MMKV blob still grows from non-recipe queries]** → Out of scope for this change. The budget only caps recipe prefetch entries. Overall MMKV size management could be a future improvement.
