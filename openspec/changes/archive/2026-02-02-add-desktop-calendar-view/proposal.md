# Change: Add Desktop Calendar View

## Why

The mobile calendar timeline works well on small screens but doesn't utilize desktop screen real estate effectively. A grid-based desktop layout with fixed-height scrollable cards will provide a better experience on larger screens.

## What Changes

- Add a new desktop calendar component with 3-column grid layout
- Cards have fixed height with scrollable content for days with many items
- Page detects viewport and renders mobile vs desktop view accordingly
- Core functionality (add item, edit, drag-drop) remains the same

## Impact

- Affected specs: new `desktop-mealplan` capability
- Affected code: `app/(app)/calendar/page.tsx`, new `components/calendar/desktop/` directory
