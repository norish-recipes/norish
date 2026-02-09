# Design: Mobile Meal Plan Timeline

## Context

The meal planning backend is fully implemented with:

- Database schema (`planned_items` table with date, slot, sortOrder, itemType, recipeId, title)
- tRPC procedures (listItems, createItem, moveItem, deleteItem, updateItem)
- WebSocket subscriptions for real-time sync
- React hooks (useCalendarQuery, useCalendarMutations, useCalendarSubscription, useCalendarDnd)

This design focuses on the mobile-specific UI components that consume this existing infrastructure.

## Goals

- Provide an intuitive, iOS-like mobile meal planning experience
- Support infinite scrolling with efficient virtualization
- Enable drag-and-drop reordering without dedicated handles
- Display rich item information (slot, kcal, servings)
- Maintain full i18n support across all 5 locales

## Non-Goals

- Desktop view implementation (separate effort)
- Backend changes (already complete)
- CalDAV sync UI (handled separately)
- Creating/editing recipes from calendar view

## Decisions

### 1. Component Architecture

**Decision:** Create a dedicated `components/calendar/mobile/` directory with modular components.

```
components/calendar/mobile/
├── MobileTimeline.tsx           # Main container with virtualization
├── TimelineDaySection.tsx       # Day header + slot containers
├── TimelineSlotContainer.tsx    # Slot with droppable area
├── TimelinePlannedItem.tsx      # Individual item (draggable)
├── TimelineScrollToToday.tsx    # Floating navigation button
└── index.ts                     # Barrel exports
```

**Rationale:** Mirrors the successful groceries/dnd pattern. Keeps components focused and testable.

### 2. Virtualization Strategy

**Decision:** Use `@tanstack/react-virtual` with `useVirtualizer`, similar to mini-calendar.

- Default range: 7 days back + 30 days forward (≈37 days)
- Overscan: 5 items for smooth scrolling
- Dynamic item sizing via `measureElement`
- Bidirectional loading triggered by scroll position thresholds

**Rationale:** Already proven in mini-calendar and mini-recipes panels. Handles variable day heights well.

### 3. Drag-and-Drop Implementation

**Decision:** Use `@dnd-kit/core` with `@dnd-kit/sortable` for within-slot reordering.

- Entire item container is draggable (no handles needed)
- Container IDs: `${date}_${slot}` format (e.g., `"2026-02-02_Breakfast"`)
- Use `DragOverlay` for visual feedback during drag
- Touch sensor with activation delay for mobile

**Rationale:** Consistent with existing useCalendarDnd hook and groceries DnD implementation.

### 4. Item Display Design

**Decision:** Card-based design with:

- Recipe image thumbnail (56x56 rounded)
- Title (truncated with ellipsis)
- Subtitle: `{slot} • {kcal} kcal • {servings} servings`
- Note items: italic styling, no image

**Rationale:** Mirrors mini-calendar DayRow pattern. Subtitle format provides at-a-glance nutritional info.

### 5. Scroll-to-Today Button

**Decision:** Floating minimal button with chevron icon.

- Appears when today is not visible in viewport
- Chevron points up/down based on scroll direction needed
- Position: bottom-right, respects safe area
- Smooth scroll animation on tap

**Rationale:** iOS-native feel, non-intrusive UX.

### 6. Loading States

**Decision:** Implement proper calendar-skeleton.tsx with:

- Day section skeletons (header + 2-3 item placeholders)
- Pulse animation
- Match timeline structure

**Rationale:** Skeleton file exists but is currently a stub.

## Risks / Trade-offs

| Risk                                       | Mitigation                                         |
| ------------------------------------------ | -------------------------------------------------- |
| Touch DnD conflicts with scroll            | Use activation delay on touch sensor (250ms hold)  |
| Variable day heights affect virtualization | Use dynamic measurement with `measureElement`      |
| Large date ranges impact performance       | Limit loaded range, use pagination for past/future |
| Translation key proliferation              | Group under `calendar.timeline.*` namespace        |

## Open Questions

None - all requirements are clear from the user request.
