# Change: Optimize Calendar Page Data Loading

## Why

The calendar page currently loads all data upfront (1 month before to 1 month after) regardless of what the user is viewing. This creates unnecessary initial load time and data transfer, especially on mobile where users scroll through ~3 months of day cards. Desktop users navigating to future/past weeks also lack visual feedback during data fetches.

## What Changes

- Add proper skeleton loaders for calendar loading states (replacing minimal existing skeleton)
- Desktop: Fetch data on-demand when navigating to weeks outside the initially loaded range
- Mobile: Load only 2 weeks before and 2 weeks after current date initially, then load additional weeks on-demand as user scrolls

## Impact

- Affected specs: calendar-ui (new capability)
- Affected code:
  - `app/(app)/calendar/context.tsx` - Dynamic date range management
  - `components/calendar/desktop-mealplan.tsx` - Trigger fetch on week navigation
  - `components/calendar/mobile-mealplan.tsx` - Infinite scroll loading
  - `components/skeleton/calendar-skeleton.tsx` - Enhanced skeleton UI
  - `hooks/calendar/use-calendar-query.ts` - Support for multiple date ranges
