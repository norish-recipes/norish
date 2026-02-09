# Tasks: Add Mobile Meal Plan Timeline

## 1. Setup & Skeleton

- [ ] 1.1 Create `components/calendar/mobile/` directory structure
- [ ] 1.2 Implement `calendar-skeleton.tsx` with proper timeline skeleton UI
- [ ] 1.3 Write tests for skeleton component rendering

## 2. Core Timeline Components (TDD)

- [ ] 2.1 Write tests for `TimelinePlannedItem` component
- [ ] 2.2 Implement `TimelinePlannedItem` - displays recipe/note with slot, kcal, servings subtitle
- [ ] 2.3 Write tests for `TimelineSlotContainer` component
- [ ] 2.4 Implement `TimelineSlotContainer` - slot header with droppable area
- [ ] 2.5 Write tests for `TimelineDaySection` component
- [ ] 2.6 Implement `TimelineDaySection` - day header + all 4 slots
- [ ] 2.7 Write tests for `MobileTimeline` container
- [ ] 2.8 Implement `MobileTimeline` - virtualized container with day sections

## 3. Virtualization & Infinite Scroll

- [ ] 3.1 Write tests for virtualization behavior (render only visible items)
- [ ] 3.2 Implement virtualized day list using `@tanstack/react-virtual`
- [ ] 3.3 Write tests for bidirectional infinite loading
- [ ] 3.4 Implement scroll-triggered loading (past when scrolling up, future when scrolling down)
- [ ] 3.5 Add initial scroll-to-today on mount

## 4. Scroll-to-Today Button

- [ ] 4.1 Write tests for `TimelineScrollToToday` visibility logic
- [ ] 4.2 Implement `TimelineScrollToToday` floating button
- [ ] 4.3 Test chevron direction based on today's position
- [ ] 4.4 Implement smooth scroll behavior on click

## 5. Drag-and-Drop

- [ ] 5.1 Write tests for drag initiation (full container draggable)
- [ ] 5.2 Write tests for drop between days/slots
- [ ] 5.3 Integrate `@dnd-kit` with touch sensor and activation delay
- [ ] 5.4 Implement `DragOverlay` for visual feedback
- [ ] 5.5 Connect to existing `useCalendarDnd` hook and `moveItem` mutation
- [ ] 5.6 Test optimistic updates on successful move

## 6. Internationalization

- [ ] 6.1 Add translation keys to `en/calendar.json`
- [ ] 6.2 Add translation keys to `nl/calendar.json`
- [ ] 6.3 Add translation keys to `fr/calendar.json`
- [ ] 6.4 Add translation keys to `de-formal/calendar.json`
- [ ] 6.5 Add translation keys to `de-informal/calendar.json`
- [ ] 6.6 Run `pnpm i18n:check` to verify all keys present

## 7. Integration & Polish

- [ ] 7.1 Create barrel export `components/calendar/mobile/index.ts`
- [ ] 7.2 Integrate timeline into calendar page for mobile viewport
- [ ] 7.3 Add loading state with skeleton
- [ ] 7.4 Test real-time subscription updates
- [ ] 7.5 Final visual polish and safe-area handling

## 8. Final Validation

- [ ] 8.1 Run full test suite (`pnpm test:run`)
- [ ] 8.2 Run type check (`pnpm typecheck`)
- [ ] 8.3 Run lint (`pnpm lint`)
- [ ] 8.4 Manual testing on mobile viewport
