## 1. Route Structure & Navigation

- [ ] 1.1 Create `apps/mobile/src/app/(tabs)/dashboard/recipe/_layout.tsx` with a Stack navigator using `headerShown: false` (custom header handled by the parallax component)
- [ ] 1.2 Create `apps/mobile/src/app/(tabs)/dashboard/recipe/[id].tsx` as the new recipe detail screen entry point (initially rendering a placeholder to validate routing)
- [ ] 1.3 Update the navigation adapter in `apps/mobile/src/context/recipes-context.tsx` to push `/(tabs)/dashboard/recipe/${id}` instead of `/(tabs)/dashboard/${id}`
- [ ] 1.4 Remove `apps/mobile/src/app/(tabs)/dashboard/[id].tsx` and replace the `<Stack.Screen name="[id]" />` in `apps/mobile/src/app/(tabs)/dashboard/_layout.tsx` with `<Stack.Screen name="recipe" options={{ headerShown: false, presentation: 'fullScreenModal' }} />`
- [ ] 1.5 Verify that navigating from a dashboard card opens the new route without tab bar or bottom accessory, and back-swipe returns to the originating tab

## 2. Recipe Detail Context Provider

- [ ] 2.1 Create `apps/mobile/src/context/recipe-detail-context.tsx` with a `MobileRecipeDetailProvider` that wraps the detail screen and provides: `recipe`, `isLoading`, `currentServings`, `adjustedIngredients`, `amountDisplayMode`, `convertingTo`
- [ ] 2.2 Implement servings scaling logic: `setServings(n)` proportionally adjusts all ingredient amounts (port from web `context.tsx` pattern — increment/decrement logic with halving below 1)
- [ ] 2.3 Implement amount display mode toggle (`decimal` / `fraction`) stored in context state
- [ ] 2.4 Implement measurement system conversion trigger that calls the AI conversion tRPC mutation, with loading state (`convertingTo`)
- [ ] 2.5 Wire `MobileRecipeDetailProvider` around the `[id].tsx` screen in the recipe layout

## 3. Parallax Hero Scroll View

- [ ] 3.1 Create `apps/mobile/src/components/recipe/parallax-hero-scroll-view.tsx` — an `Animated.ScrollView` with a reanimated parallax header (based on HeroUI cooking-onboarding pattern): header height ~50% screen, scale-on-overscroll (up to 2x), translate at 0.5x speed, opacity fade
- [ ] 3.2 Add `expo-linear-gradient` gradient overlay at the bottom of the hero (200px, from transparent to background color using `colorKit.setAlpha`)
- [ ] 3.3 Accept `headerContent` (ReactElement) and `children` props; children render with negative top margin (-100px) overlapping the hero
- [ ] 3.4 Include `contentContainerStyle` with bottom safe area padding

## 4. Media Carousel (Hero Content)

- [ ] 4.1 Create `apps/mobile/src/components/recipe/recipe-media-carousel.tsx` that builds media items from `recipe.recipeVideos` and `recipe.recipeImages` (port `buildMediaItems` logic), sorted by `order`
- [ ] 4.2 Implement single-image rendering: full-bleed `expo-image` with `contentFit="cover"` and auth headers
- [ ] 4.3 Implement multi-item carousel: horizontal `FlatList` with `pagingEnabled`, rendering images and videos, with dot indicators at the bottom
- [ ] 4.4 Implement no-media placeholder state with muted icon
- [ ] 4.5 Add image lightbox support: tapping a single image opens a fullscreen lightbox overlay

## 5. Mobile Video Player

- [ ] 5.1 Add `expo-video` dependency to `apps/mobile/package.json`
- [ ] 5.2 Create `apps/mobile/src/components/recipe/recipe-video-player.tsx` using `expo-video`'s `VideoView` component with `contentFit="cover"`
- [ ] 5.3 Implement auto-play-on-visibility: video starts muted when carousel page is active, pauses when swiped away or scrolled off screen
- [ ] 5.4 Add mute/unmute toggle button overlaying the video (glass-morphism style with blur background)
- [ ] 5.5 Add fullscreen button that triggers native iOS fullscreen via `expo-video` API
- [ ] 5.6 Implement error fallback: if video fails to load, display thumbnail image or placeholder; wrap in error boundary

## 6. Hero Overlay Controls & Utility Menu

- [ ] 6.1 Create `apps/mobile/src/components/recipe/recipe-hero-controls.tsx` with absolutely-positioned overlay buttons: back (top-left), utility menu (top-right), favorite/heart (bottom-right)
- [ ] 6.2 Style each button with `expo-blur` `BlurView` background, rounded shape, semi-transparent tint — matching the glass-morphism aesthetic
- [ ] 6.3 Wire back button to `router.back()`
- [ ] 6.4 Wire favorite button to the favorites toggle mutation (port from web `useFavoritesMutation`), with filled/outline heart states
- [ ] 6.5 Implement double-tap-to-favorite on the hero media area (wrap carousel in a double-tap detector, show brief heart animation on double-tap)
- [ ] 6.6 Create `apps/mobile/src/components/recipe/recipe-utility-menu.tsx` — an action sheet or bottom sheet triggered by the top-right menu button, containing permission-gated items:
  - Share (present in UI, handler placeholder using `Share.share()`)
  - Edit (navigates to edit screen, gated by `canEditRecipe`)
  - Keep Screen On (toggle, see wake lock task group)
  - Auto-Tag (gated by AI enabled + can edit)
  - Auto-Categorize (gated by AI enabled + can edit)
  - Detect Allergies (gated by AI enabled + can edit + user has allergies)
  - Estimate Nutrition (gated by AI enabled + can edit)
  - Delete (opens confirmation dialog, gated by `canDeleteRecipe`)
- [ ] 6.7 Ensure all overlay controls respect safe area insets (use `useSafeAreaInsets` for top positioning)
- [ ] 6.8 Add iOS 26+ detection: skip manual blur in favor of native Liquid Glass material when available

## 7. Recipe Metadata Section

- [ ] 7.1 Create `apps/mobile/src/components/recipe/recipe-header.tsx` displaying recipe name (large bold title) and optional external link icon if `recipe.url` exists
- [ ] 7.2 Create `apps/mobile/src/components/recipe/recipe-description.tsx` rendering description as markdown text
- [ ] 7.3 Create `apps/mobile/src/components/recipe/recipe-categories.tsx` rendering categories with icons (matching web: Fire=Breakfast, Sun=Lunch, Moon=Dinner, Cake=Snack) using `@expo/vector-icons`
- [ ] 7.4 Create `apps/mobile/src/components/recipe/recipe-time-info.tsx` displaying prep and total time with clock/fire icons, formatted via `formatMinutesHM`
- [ ] 7.5 Create `apps/mobile/src/components/recipe/recipe-tags.tsx` rendering tags as `Chip` components from `heroui-native`, with allergen tags highlighted in warning color and sorted first
- [ ] 7.6 Create `apps/mobile/src/components/recipe/recipe-author.tsx` displaying author avatar + name row (similar to HeroUI `author.tsx` pattern) using `Avatar` from `heroui-native`

## 8. Ingredients Section

- [ ] 8.1 Create `apps/mobile/src/components/recipe/recipe-ingredients.tsx` as the section container with header ("Ingredients"), amount display toggle, servings control, and system convert button
- [ ] 8.2 Create `apps/mobile/src/components/recipe/ingredient-row.tsx` rendering a single ingredient: checkbox area, formatted amount (via `formatAmount` from `@norish/shared`), unit, and name
- [ ] 8.3 Implement section header rendering for ingredients starting with `#` (bold text, no checkbox)
- [ ] 8.4 Implement checked/unchecked toggle state (local state array) with strikethrough + reduced opacity styling
- [ ] 8.5 Create `apps/mobile/src/components/recipe/servings-control.tsx` with +/- buttons and formatted servings display (port web logic: halving below 1, incrementing above 1)
- [ ] 8.6 Create `apps/mobile/src/components/recipe/amount-display-toggle.tsx` toggling between decimal and fraction modes
- [ ] 8.7 Create `apps/mobile/src/components/recipe/system-convert-button.tsx` showing "Convert to Metric" or "Convert to US" with loading state during AI conversion
- [ ] 8.8 Add "Add to Groceries" button below the ingredient list, wired to the groceries tRPC mutation

## 9. Steps Section

- [ ] 9.1 Create `apps/mobile/src/components/recipe/recipe-steps.tsx` as the section container with header ("Steps"), cook mode button, and wake lock toggle
- [ ] 9.2 Create `apps/mobile/src/components/recipe/step-row.tsx` rendering a single step: numbered circular badge, markdown step text, optional thumbnail image
- [ ] 9.3 Implement checked/unchecked toggle: badge changes to check icon, text gets reduced opacity
- [ ] 9.4 Implement section header rendering for steps starting with `#`
- [ ] 9.5 Implement step image thumbnails using `expo-image` with auth headers; tapping opens fullscreen lightbox
- [ ] 9.6 Create `apps/mobile/src/components/recipe/image-lightbox.tsx` — a fullscreen modal overlay for viewing step images (and hero images) with close button

## 10. Cook Mode Button

- [ ] 10.1 Create `apps/mobile/src/components/recipe/cook-mode-button.tsx` — a prominent accent-colored button with fire icon and "Cook" label (inspired by HeroUI `cook.tsx` pattern), placed in the steps section header row
- [ ] 10.2 Wire button press to a placeholder/no-op (or navigate to a future cook mode route) — the full cook mode experience will be built separately

## 11. Star Ratings

- [ ] 11.1 Create `apps/mobile/src/components/recipe/recipe-rating.tsx` — a rating section rendered after the steps list, gated by `getShowRatingsPreference(user)`
- [ ] 11.2 Create a mobile-native `StarRating` component (or adapt `@norish/ui/star-rating` for React Native): 5 tappable star icons, filled/outline states, with `onPress` handler instead of hover
- [ ] 11.3 Wire rating hooks: port `useRatingQuery` (fetches `getAverage` + `getUserRating`) and `useRatingsMutation` (calls `rate` with optimistic cache update) to work with mobile tRPC client
- [ ] 11.4 Display `userRating ?? averageRating` as current value; show loading state during mutation

## 12. Wake Lock / Keep Screen On

- [ ] 12.1 Create `apps/mobile/src/hooks/use-keep-awake.ts` — a hook wrapping `expo-keep-awake` (`activateKeepAwakeAsync` / `deactivateKeepAwake`), exposing `{ isActive, toggle, enable, disable }`
- [ ] 12.2 Wire the wake lock toggle in `recipe-utility-menu.tsx` to the keep-awake hook
- [ ] 12.3 Auto-release keep-awake when navigating away from the recipe detail screen (cleanup in useEffect)

## 13. Notes & Nutrition Sections

- [ ] 13.1 Create `apps/mobile/src/components/recipe/recipe-notes.tsx` rendering the notes field as markdown when present
- [ ] 13.2 Create `apps/mobile/src/components/recipe/recipe-nutrition.tsx` displaying calories, fat, carbs, protein per serving when nutrition data exists

## 14. Screen Assembly & i18n

- [ ] 14.1 Assemble `apps/mobile/src/app/(tabs)/dashboard/recipe/[id].tsx` composing all components inside `MobileRecipeDetailProvider` → `ParallaxHeroScrollView` with `RecipeMediaCarousel` + `RecipeHeroControls` as hero, and metadata/ingredients/notes/steps (with cook button + wake lock)/rating/nutrition as scrollable content
- [ ] 14.2 Verify all user-facing strings use `intl.formatMessage({ id: 'recipes.detail.*' })` or related namespaces — no hardcoded English
- [ ] 14.3 Test with a non-default locale to confirm translations render correctly

## 15. Cleanup & Verification

- [ ] 15.1 Remove the old placeholder `apps/mobile/src/app/(tabs)/dashboard/[id].tsx` file
- [ ] 15.2 Run TypeScript type-check (`tsc --noEmit`) on the mobile app and fix any type errors
- [ ] 15.3 Test full flow: dashboard card tap → recipe detail → parallax scroll → check ingredients → check steps → rate → back navigation → tab bar reappears
- [ ] 15.4 Test with recipes that have: no media, single image, multiple images, video + images, no ingredients, no steps, notes, nutrition, allergen tags
- [ ] 15.5 Test servings scaling: increment, decrement, below-1 halving, ingredient proportional adjustment
- [ ] 15.6 Test measurement conversion: trigger AI conversion, verify loading state, verify updated amounts
- [ ] 15.7 Test utility menu: verify permission-gated items appear/hide correctly, wake lock toggle works, delete shows confirmation
- [ ] 15.8 Test double-tap-to-favorite on hero media, single-tap heart button, verify favorite state syncs
- [ ] 15.9 Test star rating: tap to rate, verify optimistic update, verify rating persists on reload
