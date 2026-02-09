## Context

The calendar page displays meal planning data across multiple days/weeks. Currently, `CalendarContextProvider` fetches a fixed 3-month window (1 month before to 1 month after) on mount. This approach:

- Loads more data than immediately needed
- Provides no loading feedback for data outside the initial range
- Uses the same strategy for desktop (week view) and mobile (scrollable list) despite different UX patterns

## Goals / Non-Goals

**Goals:**

- Reduce initial data load by fetching only what's immediately visible
- Provide skeleton loading states during data fetches
- Maintain smooth UX with prefetching for adjacent time periods
- Keep React Query cache coherent across date ranges

**Non-Goals:**

- Changing the tRPC API (existing `calendar.listItems` with date range is sufficient)
- Implementing virtualization for mobile (may be future optimization)
- Offline support or aggressive caching strategies

## Decisions

### 1. Skeleton Loading UI

- **Decision:** Create a comprehensive calendar skeleton with week structure (desktop) and day cards (mobile)
- **Rationale:** The existing skeleton only shows a title. Proper skeletons reduce perceived loading time and prevent layout shift.

### 2. Desktop On-Demand Fetching

- **Decision:** Keep current week loaded, fetch adjacent weeks when user navigates
- **Alternatives considered:**
  - Prefetch next/prev week on hover: Added complexity, marginal benefit
  - Load all weeks upfront: Current behavior, defeats purpose
- **Implementation:** Track `currentWeekStart` in context, expand query range when navigating outside loaded range. Use React Query's `keepPreviousData` to prevent flash.

### 3. Mobile Windowed Loading (±2 weeks)

- **Decision:** Initial load of 2 weeks before and 2 weeks after today, expand window on scroll
- **Alternatives considered:**
  - Infinite scroll with fixed page size: Harder to maintain "today" position
  - Virtualized list: Higher complexity, better for very long lists
- **Implementation:** Use IntersectionObserver on boundary day cards to trigger loading more weeks. Expand the query date range dynamically.

### 4. Query Strategy

- **Decision:** Single query with expanding date range rather than multiple queries per week
- **Rationale:**
  - Simpler cache management
  - Fewer network requests
  - React Query handles caching efficiently
  - Subscription already scoped to date range

## Risks / Trade-offs

- **Risk:** User scrolls faster than data loads on mobile
  - **Mitigation:** Show per-day skeleton cards while loading, prefetch 1 week ahead of scroll position

- **Risk:** Cache fragmentation if date ranges don't align
  - **Mitigation:** Use single expanding query key, not per-week queries

- **Trade-off:** Slight delay when navigating to uncached weeks vs. upfront load of all data
  - **Acceptable:** Better initial performance, skeleton provides feedback

## Migration Plan

1. Update skeleton component first (no breaking changes)
2. Refactor context to support dynamic date ranges
3. Update desktop component to trigger range expansion
4. Update mobile component with scroll-based loading
5. All changes are additive/internal - no API changes required

## Open Questions

- None currently - implementation is straightforward refactor of existing patterns
