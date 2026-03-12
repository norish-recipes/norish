## 1. Settings Cogwheel Fix

- [x] 1.1 Read `shell-header.styles.ts` and identify the `settingsButtonIos` and `glassWrap` style tokens
- [x] 1.2 Update `settingsButtonIos` background from `rgba(255,255,255,0.08)` to a neutral adaptive value (e.g. `rgba(127,127,127,0.18)`) that is visible on both light and dark backgrounds
- [x] 1.3 Update `glassWrap` border color from `rgba(255,255,255,0.35)` to a theme-adaptive value — use `useThemeColor` in `shell-header.tsx` to resolve `separator` token and apply it as the border color
- [x] 1.4 Verify `BlurView` tint switching (`systemChromeMaterialDark` / `systemChromeMaterialLight`) is still intact and unchanged
- [x] 1.5 Visually verify the cogwheel is visible in light mode (simulator or device) and dark mode still looks correct

## 2. Planned Meal Mock Data

- [x] 2.1 Create `apps/mobile/src/lib/meals/planned-meal.types.ts` with the `PlannedMeal` type (`slot`, `recipeId | null`, `recipeTitle | null`, `imageUrl | null`, `totalDurationMinutes | null`)
- [x] 2.2 Create `apps/mobile/src/lib/meals/planned-meal-mock-data.ts` with `TODAYS_MEALS_MOCK` — three entries (Breakfast, Lunch, Dinner) with at least one linking to an ID from `recipe-mock-data.ts`

## 3. CompactRecipeCard Component

- [x] 3.1 Create `apps/mobile/src/components/home/compact-recipe-card.tsx` accepting a `MobileRecipeCardItem` prop
- [x] 3.2 Style the card with fixed width (~150px), square-ish image crop (top), title (1 line, truncated), and a secondary label line (duration or course)
- [x] 3.3 Create `apps/mobile/src/components/home/compact-recipe-card.styles.ts` with all StyleSheet styles for the compact card
- [x] 3.4 Ensure no swipe gesture handlers are included in `CompactRecipeCard`
- [x] 3.5 Use `expo-image` `Image` for the thumbnail, matching the pattern in `MobileRecipeCard`
- [x] 3.6 Use `useThemeColor` for all color values (background, text, muted text)

## 4. TodaysMeals Section Component

- [x] 4.1 Create `apps/mobile/src/components/home/todays-meals-section.tsx`
- [x] 4.2 Render a horizontal `ScrollView` with three `MealSlotCard` items — one per slot from `TODAYS_MEALS_MOCK`
- [x] 4.3 Implement filled slot card: show slot label, recipe title (truncated to 1 line), and `expo-image` thumbnail
- [x] 4.4 Implement empty slot card: show slot label and a "+" affordance (e.g., centered `+` text or Ionicons `add` icon)
- [x] 4.5 Add a `Pressable` wrapper on each slot card with `onPress` handler (no-op / console log for mockup)
- [x] 4.6 Create accompanying `.styles.ts` file for all slot card and section styles
- [x] 4.7 Apply `nestedScrollEnabled` prop on the inner horizontal `ScrollView` for Android compatibility

## 5. ContinueCooking Section Component

- [x] 5.1 Create `apps/mobile/src/components/home/continue-cooking-section.tsx`
- [x] 5.2 Accept a `recipes: MobileRecipeCardItem[]` prop and render them in a horizontal `ScrollView`
- [x] 5.3 Use `CompactRecipeCard` for each item, showing title and duration
- [x] 5.4 Add `nestedScrollEnabled` on the horizontal `ScrollView`
- [x] 5.5 Create accompanying `.styles.ts` file

## 6. Discover Section Component

- [x] 6.1 Create `apps/mobile/src/components/home/discover-section.tsx`
- [x] 6.2 Accept a `recipes: MobileRecipeCardItem[]` prop and render them in a horizontal `ScrollView`
- [x] 6.3 Use `CompactRecipeCard` for each item, showing title and course type label
- [x] 6.4 Add `nestedScrollEnabled` on the horizontal `ScrollView`
- [x] 6.5 Create accompanying `.styles.ts` file

## 7. Dashboard Section Header Component

- [x] 7.1 Create `apps/mobile/src/components/home/section-header.tsx` — a simple `View` + `Text` that renders a section title (e.g., "Today", "Continue Cooking") with consistent typography matching existing `heading` styles
- [x] 7.2 Add optional `actionLabel` + `onAction` props for a right-aligned "See all" link (optional for mockup, can be wired to no-op)

## 8. Integrate Dashboard into Recipes Screen

- [x] 8.1 Read `apps/mobile/src/app/(tabs)/recipes.tsx` in full to understand current structure
- [x] 8.2 Import `TodaysMealsSection`, `ContinueCookingSection`, `DiscoverSection`, `SectionHeader` at the top of `recipes.tsx`
- [x] 8.3 Import `TODAYS_MEALS_MOCK` and the existing `MOCK_RECIPES` array
- [x] 8.4 Add `TodaysMealsSection` with `TODAYS_MEALS_MOCK` data above the existing recipe list, preceded by a `SectionHeader` with title "Today"
- [x] 8.5 Add `ContinueCookingSection` with a slice of `MOCK_RECIPES` (e.g., first 3) preceded by a `SectionHeader` with title "Continue Cooking"
- [x] 8.6 Add `DiscoverSection` with a different slice of `MOCK_RECIPES` (e.g., reversed or offset) preceded by a `SectionHeader` with title "Discover"
- [x] 8.7 Add a `SectionHeader` with title "Your Collection" immediately above the existing swipeable recipe list
- [x] 8.8 Update the `ShellHeader` subtitle to something fitting a dashboard context (e.g., "Good morning" or the day's date, or keep as-is)
- [x] 8.9 Verify the screen still scrolls end-to-end without layout issues and the tab bar minimizes on scroll
