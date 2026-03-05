## Context

The Norish mobile app (Expo/React Native, iOS-first) has a fully-functional recipe dashboard with cards, search, and filters, but the recipe detail view is a placeholder that renders only name, description, servings, and total time. The web app has a complete recipe detail implementation with media carousel, ingredients (servings scaling, unit conversion, amount formatting), steps (checkable, with images), nutrition, tags, categories, ratings, and author attribution. The tRPC API (`recipes.get`) already returns `FullRecipeDTO` with all this data — only the mobile rendering is missing.

The app uses `heroui-native` (1.0.0-rc.3) with `uniwind` for Tailwind-in-RN styling, `expo-image` for optimized image loading, `expo-blur` for blur effects, and `react-native-reanimated` for animations. i18n is handled by `react-intl` with flattened dot-notation keys from `@norish/i18n`. The mobile tab bar uses `expo-router`'s `NativeTabs` with a bottom accessory that shows "Add Recipe" on dashboard/search tabs.

The design reference is the HeroUI Native cooking-onboarding showcase: a parallax scroll view with a 60%-height hero image that scales on overscroll and fades to content via `expo-linear-gradient`, with action buttons overlaying the hero. The user wants this pattern combined with the web recipe page's feature set, adapted to feel native on iOS with a liquid glass aesthetic.

## Goals / Non-Goals

**Goals:**
- Build a full-featured, native-feeling recipe detail screen for iOS
- Parallax hero supporting both images and videos with gradient fade
- Glass-morphism overlay controls: back button (top-left), favorite/heart (over hero), double-tap-to-favorite on hero media
- Utility/settings menu (top-right, matching dashboard pattern) with: Share, Edit, Wake Lock, Auto-Tag, Auto-Categorize, Detect Allergies, Estimate Nutrition, Delete — all permission-gated
- Feature parity with web mobile recipe page: ingredients, steps, notes, nutrition, categories, tags, author, ratings
- Star ratings (1-5) after steps section, gated by user preference, using existing `StarRating` component
- Cook mode button: prominent "Cook" action in the steps section as entry point for future guided cooking
- Wake lock / keep-screen-on: UI toggle in utility menu and auto-enable behavior near steps (native implementation may use a no-op initially)
- Servings scaling with proportional ingredient adjustment
- Measurement system conversion (metric/US) via existing AI endpoint
- Amount display toggle (decimal/fraction) using existing `formatAmount`
- Checkable ingredients and steps
- Step images with lightbox
- Full i18n using existing translation keys
- Recipe detail shown without bottom tab bar accessory
- iOS 26+ Liquid Glass awareness where applicable

**Non-Goals:**
- Android-specific optimizations (iOS-first for now)
- Full cook mode experience (step-by-step guided view) — only the entry button is included
- Inline timers within step text (web has `SmartInstruction` — not porting now)
- Add-to-calendar / meal planning from recipe detail (separate feature)
- Editing recipe content from the detail page (Edit in menu navigates to edit screen)
- Real-time subscription (can be added later; initial load is sufficient)
- Functional share implementation (Share menu item is present but actual share logic is deferred)

## Decisions

### 1. Route Structure: Nested Dashboard Route with Full-Screen Modal Presentation

**Decision**: Place the recipe detail at `apps/mobile/src/app/(tabs)/dashboard/recipe/[id].tsx`, nested inside the `(tabs)/dashboard` group, and present the `recipe` stack screen as `fullScreenModal` from the dashboard layout.

**Rationale**: Presenting the recipe screen as a `fullScreenModal` from within the dashboard stack hides the tab bar and bottom accessory automatically (iOS dismisses the tab bar for full-screen modals). Critically, this approach gives a native iOS back button in the navigation bar for free — the stack navigator renders a standard `<` back chevron in the header — without needing a custom glass-morphism back button built in code. Keeping the route nested under `(tabs)/dashboard/` also makes navigation semantics clearer: the recipe is a drill-down from the dashboard, not a separate top-level destination.

**Alternatives considered**:
- Top-level route at `apps/mobile/src/app/recipe/[id].tsx` outside `(tabs)`: Hides the tab bar but loses the native back button, requiring a custom back button overlay on the hero. This was the original design, but adds unnecessary complexity.
- Using a modal presentation (`presentation: 'modal'`): Sheet-style modal (slides up from bottom), which changes the transition feel and doesn't suit a recipe detail that should feel like a push navigation drill-down.

**Implementation**:
- Create `apps/mobile/src/app/(tabs)/dashboard/recipe/_layout.tsx` with `headerShown: false` (custom parallax header handles navigation chrome).
- Create `apps/mobile/src/app/(tabs)/dashboard/recipe/[id].tsx` as the detail screen.
- In `apps/mobile/src/app/(tabs)/dashboard/_layout.tsx`, add `<Stack.Screen name="recipe" options={{ headerShown: false, presentation: 'fullScreenModal' }} />`.
- Update navigation adapter in `recipes-context.tsx` to push `/(tabs)/dashboard/recipe/${id}`.
- Remove old `[id].tsx` from `(tabs)/dashboard/`.

### 2. Parallax Hero: Reanimated ScrollView with Animated Header

**Decision**: Implement a `ParallaxHeroScrollView` component using `react-native-reanimated`'s `useAnimatedRef`, `useScrollOffset`, and `useAnimatedStyle`, closely following the HeroUI cooking-onboarding `parallax-scroll-view.tsx` pattern.

**Rationale**: This pattern is proven in the reference app, uses the same libraries already in the project (`react-native-reanimated`, `expo-linear-gradient`), and gives smooth 60fps parallax with scale-on-overscroll and opacity fade.

**Key parameters**:
- Header height: `screenHeight * 0.5` (slightly less than reference's 0.6 to leave more content visible)
- Content overlaps header by ~100px via negative margin (`-mt-[100]`)
- Gradient height: 200px from bottom of header
- Overscroll: image scales up to 2x, translates at half speed

### 3. Media in Hero: Image Carousel + Video Player

**Decision**: Support a swipeable media carousel in the hero area. For images, use `expo-image`. For videos, use `expo-video` (the modern Expo video API replacing `expo-av`).

**Rationale**: `expo-video` provides a native video player with better performance and iOS integration than `expo-av`. The hero area displays the first/primary media item by default; if multiple items exist, show swipe dots and allow horizontal paging.

**Alternatives considered**:
- `expo-av`: Legacy API, being sunset in favor of `expo-video`. Since we're building new, go with the modern API.
- Third-party player (react-native-video): Heavier dependency, expo-video is sufficient and better integrated with Expo ecosystem.

### 4. Hero Controls & Utility Menu

**Decision**: The hero overlay has two types of controls: (1) glass-morphism buttons directly on the hero image — back (top-left) and favorite/heart (bottom-right), and (2) a utility menu button (top-right) that opens an action sheet / dropdown with recipe actions. Double-tapping the hero media toggles the favorite state.

**Rationale**: This mirrors the iOS pattern where primary navigation (back) and emotional actions (favorite) are immediate touch targets on the hero, while utility actions live in a menu to keep the visual clean. The utility menu matches the dashboard's settings-menu pattern for consistency. Double-tap-to-favorite is a well-known gesture from Instagram/social apps.

**Hero overlay layout**:
- Top-left: Back button (chevron-left) with blur background
- Top-right: Utility menu button (ellipsis/gear icon) with blur background
- Bottom-right over hero: Favorite (heart) button with blur background, filled when favorited
- Double-tap anywhere on hero: Toggles favorite state (with brief heart animation)

**Utility menu items** (matching web `actions-menu.tsx`, permission-gated):
- Share (present in UI, handler deferred)
- Edit (navigates to edit screen, if `canEditRecipe`)
- Wake Lock toggle (keep screen on, UI present, native may no-op initially)
- Auto-Tag (if AI enabled + can edit)
- Auto-Categorize (if AI enabled + can edit)
- Detect Allergies (if AI enabled + can edit + user has allergies)
- Estimate Nutrition (if AI enabled + can edit)
- Delete (opens confirmation, if `canDeleteRecipe`)

**Alternatives considered**:
- Putting share/favorite/more all in top-right row (like original design): Too many buttons over the hero, cluttered. The utility menu consolidates secondary actions.
- Putting favorite in the utility menu: Heart is a high-frequency emotional action that benefits from being a direct-tap target on the hero, not buried in a menu.

### 5. Recipe Context: Mobile-Specific Provider

**Decision**: Create a `MobileRecipeDetailProvider` that wraps the detail screen, providing recipe data, servings state, adjusted ingredients, and conversion state — mirroring the web's `RecipeContextProvider` pattern but using mobile-compatible hooks.

**Rationale**: The web context manages servings scaling, AI conversion, and nutrition estimation. Rather than trying to share the web context directly (it uses `next-intl`, web-only hooks), build a mobile-specific provider that reuses the same shared hooks (`use-recipe-query` from `@norish/shared-react`) and implements equivalent servings/conversion logic.

**State managed**:
- `recipe`: from tRPC query
- `currentServings`: local state, defaults to `recipe.servings`
- `adjustedIngredients`: proportionally scaled when servings change
- `convertingTo`: measurement system conversion target (triggers AI mutation)
- `amountDisplayMode`: 'decimal' | 'fraction'

### 6. Ingredient List: Grouped with Section Headers

**Decision**: Render ingredients as a flat list with section headers (ingredients starting with `#`), matching web behavior. Each row shows amount + unit + name, with a checkbox for cook-along use.

**Rationale**: Direct port of web ingredient list logic. Uses existing `formatAmount` from `@norish/shared` and filters by `recipe.systemUsed`.

### 7. Steps List: Numbered with Optional Images

**Decision**: Render steps as a numbered list with circular step badges, checkboxes, markdown text, and optional thumbnail images that open a lightbox.

**Rationale**: Matches web steps-list behavior. Step images use `expo-image` with the same authenticated headers pattern used elsewhere in the mobile app.

### 8. Star Ratings

**Decision**: Render a 1-5 star rating prompt after the steps section, gated by `getShowRatingsPreference(user)`. Use the existing `StarRating` component from `@norish/ui/star-rating` (or a mobile-native equivalent if the web component uses web-only APIs like hover). Wire to `trpc.ratings.rate` mutation with optimistic updates.

**Rationale**: The web already has this exact pattern. The `StarRating` component uses hover states which don't apply on mobile — either adapt with a press-only version or use `Pressable` wrappers around star icons. The tRPC mutation and query endpoints are platform-agnostic.

**Implementation**: Port the web `useRatingQuery` and `useRatingsMutation` patterns to mobile. The query fetches `getAverage` and `getUserRating`; the mutation calls `rate` with optimistic cache update. Display `userRating ?? averageRating` as the current value.

### 9. Cook Mode Button

**Decision**: Include a prominent "Cook" button in the steps section header area (inspired by the HeroUI cooking-onboarding `cook.tsx` component). The button is styled with an accent/orange color, fire icon, and "Cook" label. Tapping it is a no-op placeholder that will eventually launch a step-by-step guided cooking experience.

**Rationale**: Including the UI now establishes the interaction pattern and visual space. The full cook mode is a separate feature but the entry point should be part of the recipe detail from the start so users see it and it can be wired up later.

### 10. Wake Lock UI

**Decision**: Include a wake lock toggle in both the utility menu (as a toggleable menu item) and as an auto-enable behavior when the user scrolls to the steps section. The native implementation uses `expo-keep-awake` (already available in Expo) if possible, or a no-op wrapper if not immediately viable.

**Rationale**: `expo-keep-awake` is a lightweight Expo module (`activateKeepAwakeAsync` / `deactivateKeepAwake`) that prevents the screen from sleeping. This is simpler than the web's Wake Lock API and already available in the Expo ecosystem. Even if the native call isn't wired immediately, the UI toggle and context should be in place.

**Alternatives considered**:
- Only in utility menu: Less discoverable. Auto-enabling near steps (like web does) is the better UX for cooking scenarios.
- Using `react-native-keep-awake` third-party: Unnecessary when `expo-keep-awake` is built into Expo.

### 11. i18n: Use Existing Keys via react-intl

**Decision**: All user-facing strings use `intl.formatMessage({ id: 'recipes.detail.*' })` and related namespaces. No new translation keys are needed.

**Rationale**: The `@norish/i18n` package already has comprehensive recipe detail translations. The mobile app's `react-intl` setup with flattened keys maps directly to these.

## Risks / Trade-offs

- **[expo-video maturity]** `expo-video` is newer and may have edge cases on older iOS versions. → Mitigation: Wrap video player in error boundary; fall back to thumbnail image if video fails to load. Test on iOS 16+ range.

- **[AI conversion latency]** Unit conversion goes through AI which has variable latency. → Mitigation: Show loading spinner on conversion button; disable while converting; cache results so re-toggling is instant.

- **[Large component surface area]** The recipe detail is feature-rich and could become a monolithic file. → Mitigation: Decompose into focused components: `RecipeHero`, `RecipeIngredients`, `RecipeSteps`, `RecipeNotes`, `RecipeNutrition`, `RecipeHeader`, `RecipeTags`, `RecipeActions`.

- **[Navigation transition]** The `fullScreenModal` presentation slides up from the bottom rather than pushing from the right, which may feel unexpected for a drill-down. → Mitigation: Evaluate whether `presentation: 'fullScreenModal'` or `presentation: 'card'` (with the tab bar hidden via layout logic) gives the better iOS feel during testing; the route path is the same regardless.

- **[Image auth headers]** Recipe images require auth headers. expo-image handles this, but video sources may need different handling with expo-video. → Mitigation: Verify expo-video supports custom headers; if not, use a signed URL approach or proxy.
