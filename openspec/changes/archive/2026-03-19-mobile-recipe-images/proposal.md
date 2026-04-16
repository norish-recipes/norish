## Why

The mobile app incorrectly resolves recipe images. `RecipeDashboardSchema` and `FullRecipeSchema` both expose an `image` thumbnail URL, as well as `images` and `videos` arrays with the full media paths. The web app already uses these via `buildMediaItems` (with videos first, gallery images sorted by order, and `recipe.image` as a legacy fallback) and renders a `FallbackPlaceholder` when a URL 404s — the mobile app does not consistently surface the correct images on recipe cards, and has no fallback UI when an image fails to load.

## What Changes

- **Recipe card thumbnail resolution**: Update `RecipeCardImage` / `mapDashboardRecipeToCardItem` to resolve the thumbnail URL correctly and show a "No image" placeholder when the URL returns a 404 or is missing.
- **Recipe detail media header fallback**: Add 404-error handling to `RecipeMediaHeader` so that broken image slides are replaced by a styled "No image" container instead of rendering blank space.
- **Consistent image URL resolution**: Consolidate the duplicate `resolveRecipeImageUrl` helper in `map-dashboard-recipe-to-card-item.ts` to use the canonical `resolveImageUrl` / `resolveImageUri` from `resolve-image-url.ts`.

## Capabilities

### New Capabilities

- `mobile-image-fallback`: Reusable "No image found" placeholder component for the mobile app, handling both recipe cards and the recipe detail media header when images 404 or are missing.

### Modified Capabilities

- `mobile-home-recipe-cards`: Recipe card image resolution must use the canonical URL helper and render a fallback placeholder when the image URL is missing or fails to load (404).

## Impact

- **`apps/mobile/src/components/home/recipe-card-image.tsx`** — Add onError / fallback logic to `expo-image`.
- **`apps/mobile/src/components/recipe-detail/recipe-media-header.tsx`** — Add per-slide error tracking and fallback rendering for broken image slides.
- **`apps/mobile/src/lib/recipes/map-dashboard-recipe-to-card-item.ts`** — Remove duplicated `resolveRecipeImageUrl`, import from `resolve-image-url.ts`.
- **`apps/mobile/src/lib/recipes/resolve-image-url.ts`** — No changes expected; already canonical.
- **`apps/mobile/src/lib/recipes/map-recipe-to-media-items.ts`** — No logic changes expected; already uses `resolveImageUri`.
- No backend / schema changes. No new dependencies.
