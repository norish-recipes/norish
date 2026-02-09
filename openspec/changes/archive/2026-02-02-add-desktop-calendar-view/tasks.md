## 1. Implementation

- [x] 1.1 Create `components/calendar/desktop/` directory with index barrel export
- [x] 1.2 Create `DesktopTimeline` component with 3-column CSS grid layout
- [x] 1.3 Create `DesktopDayCard` component with fixed height and overflow-y scroll
- [x] 1.4 Integrate virtualization for efficient rendering of large date ranges
- [x] 1.5 Reuse existing drag-and-drop logic from mobile (DndContext, sensors)
- [x] 1.6 Update `app/(app)/calendar/page.tsx` to conditionally render mobile vs desktop based on viewport

## 2. Validation

- [x] 2.1 Verify 3-column grid displays correctly on desktop viewports
- [x] 2.2 Verify cards maintain fixed height with scrollable overflow
- [x] 2.3 Verify drag-and-drop works between day cards
- [x] 2.4 Verify mobile view still renders correctly on small screens
- [x] 2.5 Run build and fix any type errors
