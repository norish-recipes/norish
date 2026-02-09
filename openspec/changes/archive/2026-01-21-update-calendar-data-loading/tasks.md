## 1. Skeleton Loaders

- [x] 1.1 Create `CalendarSkeletonDesktop` component with week grid structure (7 columns, slot rows)
- [x] 1.2 Create `CalendarSkeletonMobile` component with day card skeletons
- [x] 1.3 Update `components/skeleton/calendar-skeleton.tsx` to render appropriate skeleton per viewport
- [x] 1.4 Add inline skeleton states for individual day/week loading within components

## 2. Context Refactoring

- [x] 2.1 Add `dateRange` state to context with `expandRange(direction: 'past' | 'future')` method
- [x] 2.2 Update initial range: desktop = current week, mobile = ±2 weeks from today
- [x] 2.3 Expose `isLoadingMore` state for boundary loading indicators
- [x] 2.4 Ensure subscription updates when date range expands

## 3. Desktop On-Demand Loading

- [x] 3.1 Track loaded week range in context
- [x] 3.2 On `onNextWeek`/`onPrevWeek`, check if target week is outside loaded range
- [x] 3.3 Trigger range expansion when navigating to unloaded weeks
- [x] 3.4 Show skeleton overlay or loading indicator during fetch
- [ ] 3.5 Prefetch adjacent week data after current week loads (optional optimization) - Cancelled: not needed for MVP

## 4. Mobile Scroll-Based Loading

- [x] 4.1 Add IntersectionObserver on first and last rendered day cards
- [x] 4.2 When boundary card enters viewport, trigger `expandRange` in appropriate direction
- [x] 4.3 Render skeleton day cards at boundaries while loading
- [x] 4.4 Maintain scroll position when new content is prepended (for past dates)

## 5. Testing & Validation

- [x] 5.1 Test desktop navigation across month boundaries
- [x] 5.2 Test mobile scroll loading in both directions
- [x] 5.3 Verify skeleton states appear during loading
- [x] 5.4 Confirm subscription updates work for newly loaded ranges
- [x] 5.5 Test drag-and-drop still works across loaded/loading boundaries
