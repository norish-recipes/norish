# Change: Add rating and like visibility preferences

## Why

Users may not want to see the rating or like/favorite systems in the UI. Adding per-user preferences to hide these features provides a cleaner experience for users who don't use them, while keeping both enabled by default for users who do.

## What Changes

- Add `showRatings` boolean preference (default `true`) to user preferences schema
- Add `showFavorites` boolean preference (default `true`) to user preferences schema
- Add toggle switches for both preferences in the settings PreferencesCard
- Conditionally hide rating UI elements (star ratings on recipe cards, recipe detail pages) when `showRatings` is `false`
- Conditionally hide favorite/like UI elements (heart icon on recipe cards, recipe detail pages) when `showFavorites` is `false`
- Remove the "Favorites & Rating" section from the filters panel when both are disabled; remove just the rating filter when only ratings are hidden; remove just the favorites filter when only favorites are hidden

## Impact

- Affected specs: `user-preferences`
- Affected code:
  - `server/db/zodSchemas/user.ts` — add new preference keys
  - `server/trpc/routers/user/types.ts` — add to update input schema
  - `lib/user-preferences.ts` — add getter helpers
  - `app/(app)/settings/user/components/preferences-card.tsx` — add toggle UI
  - `components/Panel/consumers/filters-panel.tsx` — conditionally render rating/favorites filters
  - `components/dashboard/recipe-card.tsx` — conditionally render rating and favorite UI
  - `app/(app)/recipes/[id]/recipe-page-desktop.tsx` — conditionally render rating and favorite UI
  - `app/(app)/recipes/[id]/recipe-page-mobile.tsx` — conditionally render rating and favorite UI
