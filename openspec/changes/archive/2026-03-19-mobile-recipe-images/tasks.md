## 1. Shared Placeholder Component

- [x] 1.1 Create `apps/mobile/src/components/shared/no-image-placeholder.tsx` with a `NoImagePlaceholder` component that renders a centred `Ionicons.image-outline` icon over a neutral `bg-default-200` background, accepting an optional `variant` prop (`"card"` | `"header"`) to control sizing
- [x] 1.2 Export `NoImagePlaceholder` from the shared components barrel (or verify direct imports work with the `@/` alias)

## 2. Consolidate URL Resolution

- [x] 2.1 In `apps/mobile/src/lib/recipes/map-dashboard-recipe-to-card-item.ts`, remove the inline `resolveRecipeImageUrl` function and import `resolveImageUrl` from `@/lib/recipes/resolve-image-url` instead
- [x] 2.2 Update `mapDashboardRecipeToCardItem` to use `resolveImageUrl(recipe.image, backendBaseUrl, authCookie)` and return the full `AuthenticatedImageSource` (or destructure `uri` / `headers`) into the `RecipeCardItem`

## 3. Recipe Card Image Fallback

- [x] 3.1 In `apps/mobile/src/components/home/recipe-card-image.tsx`, add an `onError` handler to the `expo-image` `<Image>` that sets a local `hasError` state to `true`
- [x] 3.2 When `hasError` is `true` or `imageUrl` is empty/null, render `<NoImagePlaceholder variant="card" />` instead of the `<Image>`
- [x] 3.3 Ensure the placeholder matches the same container dimensions (`styles.imageContainer` / `styles.imageFill`) so there is no layout shift

## 4. Recipe Detail Media Header Fallback

- [x] 4.1 In `RecipeMediaHeader`, add a `useState<Set<number>>` to track slide indices that failed to load
- [x] 4.2 In the `MediaSlide` image branch, add an `onError` callback to `expo-image` that reports the failed index back to the parent via a new `onSlideError` prop
- [x] 4.3 When a slide index is in the error set, render `<NoImagePlaceholder variant="header" />` instead of the `<Image>`
- [x] 4.4 When the `media` array is empty, render a single `<NoImagePlaceholder variant="header" />` as the full-bleed background in `RecipeMediaHeader`

## 5. Verification

- [x] 5.1 Manually verify on iOS: recipe card with a valid image displays correctly
- [x] 5.2 Manually verify on iOS: recipe card with a missing/404 image shows the placeholder
- [x] 5.3 Manually verify on iOS: recipe detail page with working images/video renders correctly
- [x] 5.4 Manually verify on iOS: recipe detail page with a broken image URL shows the placeholder for that slide only
- [x] 5.5 Manually verify on iOS: recipe detail page with no media at all shows a full-bleed placeholder
- [x] 5.6 Run `pnpm typecheck` in `apps/mobile` to confirm no type errors
