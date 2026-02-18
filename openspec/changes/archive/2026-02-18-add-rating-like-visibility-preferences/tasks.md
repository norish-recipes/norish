## 1. Schema and API

- [x] 1.1 Add `showRatings` and `showFavorites` optional boolean fields to `UserPreferencesSchema` in `server/db/zodSchemas/user.ts`
- [x] 1.2 Add `showRatings` and `showFavorites` to `UpdatePreferencesInputSchema` in `server/trpc/routers/user/types.ts`

## 2. Client helpers

- [x] 2.1 Add `getShowRatingsPreference(user, fallback=true)` helper in `lib/user-preferences.ts`
- [x] 2.2 Add `getShowFavoritesPreference(user, fallback=true)` helper in `lib/user-preferences.ts`

## 3. Settings UI

- [x] 3.1 Add "Show Ratings" toggle to `preferences-card.tsx`
- [x] 3.2 Add "Show Favorites" toggle to `preferences-card.tsx`
- [x] 3.3 Add translation keys for new toggle labels in locale files

## 4. Filters panel

- [x] 4.1 Read `showRatings` and `showFavorites` preferences in `filters-panel.tsx`
- [x] 4.2 Conditionally render the favorites toggle based on `showFavorites`
- [x] 4.3 Conditionally render the RatingStars filter based on `showRatings`
- [x] 4.4 Hide the entire "Favorites & Rating" section when both are disabled

## 5. Recipe UI

- [x] 5.1 Conditionally render rating UI in `recipe-card.tsx` based on `showRatings`
- [x] 5.2 Conditionally render favorite UI in `recipe-card.tsx` based on `showFavorites`
- [x] 5.3 Conditionally render rating UI in `recipe-page-desktop.tsx` based on `showRatings`
- [x] 5.4 Conditionally render favorite UI in `recipe-page-desktop.tsx` based on `showFavorites`
- [x] 5.5 Conditionally render rating UI in `recipe-page-mobile.tsx` based on `showRatings`
- [x] 5.6 Conditionally render favorite UI in `recipe-page-mobile.tsx` based on `showFavorites`

## 6. Testing

- [x] 6.1 Update `preferences-card.test.tsx` with tests for new toggles
- [x] 6.2 Update `filters-panel.test.tsx` to verify conditional rendering based on preferences
