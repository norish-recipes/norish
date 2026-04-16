## Purpose

Viewability-driven prefetching of full recipe data on mobile, with a bounded cache budget to limit MMKV usage and device memory pressure.

## Requirements

### Requirement: Visible recipe cards are prefetched on the dashboard

The mobile app SHALL prefetch full recipe data (`recipes.get`) for recipe cards that become visible on the dashboard screen, so that navigating to a recipe detail page resolves instantly from the TanStack Query cache.

#### Scenario: Recipe card scrolls into view on dashboard

- **WHEN** a recipe card enters the viewable area of the dashboard `FlatList`
- **AND** the full recipe data is not already in the query cache
- **THEN** the app SHALL call `queryClient.prefetchQuery` for that recipe's `recipes.get` query

#### Scenario: Recipe card is already cached

- **WHEN** a recipe card enters the viewable area
- **AND** the full recipe data already exists in the query cache and is not stale
- **THEN** the app SHALL NOT issue a redundant prefetch request

#### Scenario: User navigates to prefetched recipe

- **WHEN** the user taps a recipe card that was previously prefetched
- **THEN** the recipe detail screen SHALL render immediately from cache without a loading state

---

### Requirement: Visible recipe cards are prefetched on the search screen

The mobile app SHALL prefetch full recipe data for recipe cards visible on the search results screen, using the same mechanism as the dashboard.

#### Scenario: Search result recipe scrolls into view

- **WHEN** a recipe card enters the viewable area of the search results `FlatList`
- **AND** the full recipe data is not already in the query cache
- **THEN** the app SHALL call `queryClient.prefetchQuery` for that recipe's `recipes.get` query

---

### Requirement: Prefetch requests are debounced during fast scrolling

The prefetch trigger SHALL be debounced so that rapid scrolling does not cause a burst of network requests for recipes that are only briefly visible.

#### Scenario: User scrolls quickly through the list

- **WHEN** the viewable items change multiple times within a short interval (< 300 ms)
- **THEN** the app SHALL only issue prefetch requests for the items visible after the scroll settles

#### Scenario: User scrolls slowly

- **WHEN** the viewable items change and remain stable for ≥ 300 ms
- **THEN** the app SHALL issue prefetch requests for all currently visible items

---

### Requirement: Prefetch cache is bounded by a maximum entry count

The app SHALL maintain at most a configured maximum number of prefetched full-recipe entries (default: 30) in the TanStack Query cache. When a new prefetch would exceed this limit, the oldest prefetched entry SHALL be evicted.

#### Scenario: Budget not yet reached

- **WHEN** fewer than 30 recipes have been prefetched in the current session
- **THEN** new prefetch entries SHALL be added to the cache without eviction

#### Scenario: Budget exceeded

- **WHEN** 30 recipes have been prefetched and a new recipe becomes visible
- **THEN** the oldest prefetched recipe entry SHALL be removed from the query cache
- **AND** the new recipe SHALL be prefetched and tracked

#### Scenario: Naturally-fetched recipes are not counted against the budget

- **WHEN** a recipe was loaded by navigating to its detail page (not via prefetch)
- **THEN** it SHALL NOT be counted against the prefetch budget
- **AND** it SHALL NOT be evicted by the prefetch budget mechanism

---

### Requirement: Prefetch failures are silent

Prefetch failures SHALL NOT surface error states to the user. Failed prefetches are non-critical — the recipe will load normally when the user taps the card.

#### Scenario: Prefetch network error

- **WHEN** a prefetch request fails due to a network error
- **THEN** no error toast, alert, or UI indicator SHALL be shown
- **AND** the recipe SHALL load normally on tap via the standard query flow

#### Scenario: Prefetch retries

- **WHEN** a prefetch request fails
- **THEN** the app SHALL retry once after a short delay (1 second)
- **AND** if the retry also fails, the prefetch SHALL be silently abandoned
