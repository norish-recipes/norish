## Context

The web app resolves recipe media through `buildMediaItems()` in `media-carousel.tsx`, which combines `recipe.videos` (sorted by order), `recipe.images` (sorted by order), and falls back to `recipe.image` when no gallery images exist. It tracks image errors via `useImageErrors()` and renders a `FallbackPlaceholder` ("No image available") for any broken URL.

The mobile app has a parallel `mapRecipeToMediaItems()` in `map-recipe-to-media-items.ts` with the same ordering logic. However:

1. **Recipe cards** — `RecipeCardImage` uses `expo-image` with no `onError` handler. If `recipe.imageUrl` 404s, the card shows a black box (the container background).
2. **Recipe detail header** — `RecipeMediaHeader` renders `expo-image` slides with no error tracking. A broken image shows nothing.
3. **Duplicate URL helper** — `map-dashboard-recipe-to-card-item.ts` contains its own inline `resolveRecipeImageUrl` instead of importing the canonical `resolveImageUrl` from `resolve-image-url.ts`.

## Goals / Non-Goals

**Goals:**

- Every recipe image surface in the mobile app shows a styled "No image" placeholder when the image URL is missing or fails to load (404, network error, etc.).
- Consolidate URL resolution to the single canonical source (`resolve-image-url.ts`).
- Match the web's behaviour: videos first → gallery images → `recipe.image` as fallback, with error-state fallback rendering.

**Non-Goals:**

- Changing the server-side image storage, schema, or URL format.
- Adding retry/caching logic for failed images (expo-image already caches).
- Modifying the web app.
- Changing video error handling (already has a poster image fallback).

## Decisions

### 1. Reusable `NoImagePlaceholder` component

**Decision**: Create a small shared RN component at `apps/mobile/src/components/shared/no-image-placeholder.tsx`.

**Rationale**: Both the recipe card and the media header need the same visual treatment. A shared component avoids duplication and ensures consistency. The web does the same with `FallbackPlaceholder`.

**Design**: The component renders a centred icon (e.g., `Ionicons.image-outline`) over a neutral `bg-default-200` background, matching the app's design language. It accepts an optional size prop (`card` | `header`) to adapt for different contexts.

### 2. Error tracking via `expo-image` `onError` callback

**Decision**: Use `expo-image`'s `onError` prop to track per-source errors in component state.

**Alternative considered**: Prefetching URLs and filtering — rejected because it adds latency and complexity. `onError` is the same pattern the web uses with `NextImage.onError`.

**Card**: A single `useState<boolean>` in `RecipeCardImage`. On error, swap the `<Image>` for `<NoImagePlaceholder variant="card" />`.

**Media header**: A `useState<Set<number>>` (error indices) in `RecipeMediaHeader`. On error for index `i`, add it to the set. When rendering a slide at index `i` in the error set, show the placeholder instead of the image.

### 3. Consolidate `resolveRecipeImageUrl` into `resolveImageUrl`

**Decision**: Delete the inline `resolveRecipeImageUrl` in `map-dashboard-recipe-to-card-item.ts` and import `resolveImageUrl` from `resolve-image-url.ts` instead.

**Rationale**: Eliminates a maintenance risk — the inline version doesn't attach auth headers. Using the canonical version ensures cookies are always sent, which matters for self-hosted instances with auth-gated media.

### 4. No changes to `mapRecipeToMediaItems`

**Decision**: The existing ordering logic in `mapRecipeToMediaItems` is already correct (videos → gallery images → `recipe.image` fallback). No changes needed.

## Risks / Trade-offs

- **Layout shift on error** — When an image errors after partial load, the placeholder will pop in. Mitigated by using `expo-image`'s `transition` prop to make the swap smooth and by having the placeholder match the same dimensions.
- **Missing `onError` on video poster** — The `VideoSlide` already renders a fallback poster behind the `<VideoView>`, so a broken poster is naturally occluded by the video player. No additional handling needed.
- **Auth cookie forwarding** — `RecipeCardImage` currently passes `imageHeaders` for authenticated image fetches. After switching to `resolveImageUrl`, the same `AuthenticatedImageSource` type will be used, preserving header forwarding. Verified: `expo-image` supports `{ uri, headers }` source format.
