## Why

On web, the `useRecipePrefetch` hook uses `IntersectionObserver` to prefetch full recipe data (`recipes.get`) as cards scroll into view, so tapping a recipe card opens instantly from cache. The mobile app has no equivalent — every recipe detail tap triggers a cold fetch, producing a noticeable loading delay. Additionally, the TanStack Query cache is persisted via MMKV with no size controls; as recipes accumulate, the serialized cache blob can grow unbounded, increasing memory pressure and startup restore time on constrained devices.

## What Changes

- **Add a `useRecipePrefetch` hook for React Native** that uses `FlatList` `onViewableItemsChanged` (or equivalent viewability tracking) to prefetch `recipes.get` for recipe cards currently visible on the dashboard and search screens.
- **Introduce a bounded cache budget for recipe prefetch data** that caps the number of individually-prefetched full recipe entries persisted to MMKV at any time (e.g. most-recent N), evicting the oldest prefetched entries when the limit is exceeded.
- **Expose the prefetch hook through the shared-react layer** where possible, keeping the `IntersectionObserver` (web) and `FlatList` viewability (mobile) implementations as platform adapters behind a common contract.

## Capabilities

### New Capabilities

- `mobile-recipe-prefetch`: Viewability-driven prefetching of full recipe data on mobile, with a configurable cache budget to bound MMKV usage.

### Modified Capabilities

- `mobile-offline-cache`: Add a requirement that the persisted cache should respect a maximum number of individually-prefetched recipe entries to limit device storage usage.

## Impact

- **`apps/mobile`**: New hook (`use-recipe-prefetch.ts`), integration into dashboard and search `FlatList` components, possible cache eviction utility.
- **`packages/shared-react`**: Potential shared prefetch contract if abstraction is warranted; otherwise mobile-only.
- **`apps/mobile/src/lib/query-cache`**: Cache budget enforcement — either via a `shouldDehydrateQuery` filter refinement or a separate eviction pass before persist.
- No API / backend changes required.
