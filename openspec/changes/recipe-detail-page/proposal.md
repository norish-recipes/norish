## Why

The mobile recipe detail page is a placeholder that only shows name, description, servings count, and total time in a single Card. The full `FullRecipeDTO` is already fetched but none of the rich data (ingredients, steps, media, nutrition, tags, categories) is rendered. Users currently cannot cook from, save, share, or interact with a recipe on mobile in any meaningful way.

The recipe page should also be extracted from the dashboard tab's navigation stack so it operates as a standalone experience — no bottom tab bar accessory, full-screen immersive feel — similar to how native iOS recipe/content apps present detail views.

## What Changes

- **New standalone recipe detail screen**: A full-featured, iOS-native-feeling recipe detail page with parallax hero media (images + videos), liquid glass-style overlaid controls, ingredients with servings scaling and unit conversion, numbered steps with checkboxes, notes, nutrition, tags/categories, author attribution, and star ratings.
- **Route restructuring**: Move the recipe detail route out of `(tabs)/dashboard/[id]` into a top-level modal/stack route so it does not inherit the tab bar or bottom accessory. Navigation from dashboard cards opens the recipe in this new route.
- **Mobile video playback**: Introduce video playback on mobile using `expo-video` within the hero media section, supporting auto-play-on-visibility, mute/unmute, and native fullscreen.
- **Parallax scroll with gradient fade**: A `react-native-reanimated` parallax scroll view where the hero image/video bleeds to screen edges, scales on overscroll, and fades into content via a gradient overlay — inspired by the HeroUI Native cooking-onboarding pattern.
- **Hero overlay controls**: Back button (top-left) and favorite/heart button with glass-morphism blur background over the hero media. Double-tapping the hero image/video toggles the favorite state.
- **Utility menu (top-right)**: A settings/actions menu (matching the dashboard pattern) with: Share, Edit, Wake Lock toggle, Auto-Tag, Auto-Categorize, Detect Allergies, Estimate Nutrition, Delete — all permission-gated.
- **Cook mode button**: A prominent "Cook" action button in the steps section that will launch a step-by-step guided cooking view. The UI/button is included now; the full cook mode experience will be built separately.
- **Wake lock / keep-screen-on**: UI toggle in the utility menu and auto-enabled behavior in the steps section. The native implementation may be deferred but the UI surface is present.
- **Star ratings**: A 1-5 star rating prompt after the steps section (gated by user preference), using existing `StarRating` component and rating tRPC mutations.
- **Ingredients section**: Checkable ingredient rows with amount formatting (decimal/fraction toggle), servings +/- stepper with proportional scaling, measurement system conversion (metric/US via AI), and "add to groceries" action.
- **Steps section**: Numbered checkable steps with optional step images (thumbnail + lightbox), smart markdown rendering, wake lock toggle, and cook mode entry point.
- **Full i18n coverage**: All strings use `react-intl` with existing `recipes.detail.*`, `recipes.form.*`, and `recipes.actions.*` keys from `@norish/i18n`.

## Capabilities

### New Capabilities
- `mobile-recipe-detail`: The full recipe detail viewing experience on mobile — layout, parallax hero, media display, ingredients, steps, notes, nutrition, categories/tags, author, ratings, utility menu, cook mode button, and wake lock UI.
- `mobile-recipe-video`: Video playback within the mobile recipe detail hero section — auto-play, mute, fullscreen, and visibility-based lifecycle.

### Modified Capabilities
- `mobile-ui`: Recipe detail route moves out of tab stack to a standalone presentation without bottom accessory.

## Impact

- **Routing**: `apps/mobile/src/app/(tabs)/dashboard/[id].tsx` is replaced by a new route (e.g., `apps/mobile/src/app/recipe/[id].tsx`) outside the `(tabs)` group. The dashboard stack layout removes its `[id]` screen definition. Navigation adapter in `recipes-context.tsx` updates to push the new route.
- **Dependencies**: New dependency on `expo-video` for mobile video playback. Continued use of `expo-image`, `expo-blur`, `react-native-reanimated`, `heroui-native`, `uniwind`. Existing `@norish/ui/star-rating` component reused for ratings.
- **Shared hooks**: Leverages existing `use-recipe-query`, `use-recipe-images`, `use-recipe-videos`, `use-recipe-ingredients` from `@norish/shared-react`. Rating hooks (`use-ratings-query`, `use-ratings-mutation`) need mobile equivalents or ports from web. The web recipe context (`context.tsx`) servings/conversion logic should inform a mobile equivalent.
- **i18n**: No new translation keys expected — uses existing `recipes.detail.*`, `recipes.form.*`, `recipes.actions.*`, `recipes.carousel.*`, `recipes.nutrition.*` namespaces.
- **API**: No backend changes. Uses existing `trpc.recipes.get` query and real-time subscription.
