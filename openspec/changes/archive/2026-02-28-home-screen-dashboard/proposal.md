## Why

The recipes tab currently functions as the app's home screen, but presents a static list with no contextual awareness — it doesn't surface what matters to the user right now. Additionally, the settings cogwheel is invisible on light mode due to a near-transparent white background on a white surface, creating a usability gap. A richer, more contextual home screen will make the app feel alive and purposeful from the moment it opens.

## What Changes

- The recipes tab is reframed as a **Home / Dashboard** screen with multiple scrollable sections rather than a flat recipe list
- A **"Today's Meals" section** is added at the top, showing planned meals for the day (Breakfast, Lunch, Dinner) with quick-tap navigation to those recipes
- A **"Recently Viewed" or "Continue Cooking" section** surfaces the last few interacted recipes for fast re-entry
- A **"Discover" / "Suggested for You" section** provides a horizontally scrollable row of recipe cards based on tags or course variety
- The dedicated flat recipe list moves to a separate "Collection" section or is kept below the dashboard sections
- The settings cogwheel button is fixed so it is visible in both light and dark mode — replacing the near-invisible white tint with a proper adaptive surface color

## Capabilities

### New Capabilities

- `home-dashboard`: A sectioned, scrollable home screen replacing the flat recipe list as the primary entry point. Includes a Today's Meals section, a Continue Cooking section, and a Discover section. Uses mock data for this phase.
- `home-settings-icon-fix`: The shell header cogwheel icon gains a visible, theme-adaptive background that works correctly in both light and dark mode.

### Modified Capabilities

- `mobile-home-recipe-cards`: The recipe card component continues to be used but is now embedded within named dashboard sections rather than a plain flat list. No spec-level behavior changes to the card itself.

## Impact

- `apps/mobile/src/app/(tabs)/recipes.tsx` — restructured into a dashboard layout
- `apps/mobile/src/components/shell/shell-header.tsx` — cogwheel button background updated
- `apps/mobile/src/components/shell/shell-header.styles.ts` — style tokens updated for visibility
- New component(s) under `apps/mobile/src/components/home/` for dashboard sections (TodaysMeals, ContinueCooking, DiscoverRow)
- Mock data extended with planned meal data in `apps/mobile/src/lib/`
- No backend, API, or shared package changes required for this phase
