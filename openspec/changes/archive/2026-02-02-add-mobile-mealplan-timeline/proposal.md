# Change: Add Mobile Meal Plan Timeline View

## Why

Users need a dedicated mobile interface for viewing and managing their meal planning calendar. The current implementation only has a mini-calendar panel for adding recipes from recipe detail pages. A full-featured mobile timeline view will enable users to plan meals, view upcoming schedules, and reorganize items via drag-and-drop directly from their mobile devices.

## What Changes

- Add new mobile meal plan timeline component with iOS-like modern design
- Implement virtualized infinite scrolling timeline (previous week + next month by default)
- Support all four meal slots: Breakfast, Lunch, Dinner, Snack
- Display planned items (recipes and notes) with slot, kcal, and servings subtitle
- Enable drag-and-drop to move items between days/slots (full container draggable)
- Add "scroll to today" floating button when current day is out of view
- Implement proper skeleton loading states
- Add complete i18n translations for all 5 supported languages
- Use TDD approach with comprehensive test coverage

## Impact

- Affected specs: `mobile-mealplan` (new), `mobile-ui` (reference only)
- Affected code:
  - `components/calendar/mobile/` - New timeline components
  - `components/skeleton/calendar-skeleton.tsx` - Proper implementation
  - `i18n/messages/*/calendar.json` - Translation additions
  - `app/(app)/calendar/` - Page integration
