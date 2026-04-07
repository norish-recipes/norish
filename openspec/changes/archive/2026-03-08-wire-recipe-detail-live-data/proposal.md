## Why

The mobile recipe detail page currently renders entirely from a hardcoded `DUMMY_RECIPE` object with custom `Dummy*` types. All the shared infrastructure to fetch, subscribe to, and mutate real recipe data already exists—the `shared-react` package provides a `createRecipeDetailContext` factory, recipe query/subscription hooks, rating hooks, and favorites hooks. The web app already consumes these. The mobile app needs the same wiring so users see their actual recipes instead of placeholder data.

## What Changes

- **Create a mobile `RecipeDetailProvider`** by calling `createRecipeDetailContext` with mobile-specific adapters (mirroring the web's `context.tsx`), providing recipe query, subscription, nutrition, auto-tagging, auto-categorization, allergy detection, and measurement conversion support.
- **Export recipe-family hooks for mobile** — re-export `sharedRecipeFamilyHooks` members (useRecipeQuery, useRecipeSubscription, useNutritionQuery, useNutritionMutation, useNutritionSubscription, useAutoTagging*, useAutoCategorization*, useAllergyDetection\*, useConvertMutation) as individual hook files, following the same pattern already used for dashboard hooks.
- **Wire the `[id].tsx` screen** to use `RecipeDetailProvider` + `useRecipeContext` instead of importing `DUMMY_RECIPE`. Pass the route param `id` to the provider.
- **Adapt all recipe-detail components** to accept `FullRecipeDTO`-shaped data (from `@norish/shared/contracts`) instead of `Dummy*` types:
  - `RecipeIngredients` → accept `RecipeIngredientsDto[]` (with `ingredientName`, nullable `amount`, `unit`, `order`)
  - `RecipeSteps` → accept `StepStepSchema[]` (with `step` text field, `order`, `images`)
  - `RecipeNutrition` → accept nullable `calories`, `fat`, `carbs`, `protein` directly from `FullRecipeDTO`
  - `RecipeMediaHeader` → build `MediaItem[]` from `FullRecipeDTO.images` + `FullRecipeDTO.videos` + `FullRecipeDTO.image` (primary image)
  - `RecipeRating` → wire to `useRatingQuery`/`useRatingsMutation` for persisted ratings
  - `RecipeLikedButton` → wire to `useFavoritesMutation` for persisted favorites
  - `RecipeAuthor` → use `FullRecipeDTO.author` (AuthorDTO shape)
  - `RecipeHighlights` → use `prepMinutes`, `cookMinutes`, `totalMinutes` from FullRecipeDTO (all nullable)
  - `RecipeTags` → use `FullRecipeDTO.tags` (string array)
- **Add loading & error states** to the recipe detail screen (skeleton/spinner while loading, not-found state).
- **Build authenticated image URIs** — resolve relative image paths against `backendBaseUrl` and pass auth headers/cookies, matching the pattern already used in `RecipesProvider` for dashboard cards.
- **Remove `dummy-data.ts`** once all components are wired to real data.
- **Leave add-to-groceries and add-to-calendar** as placeholder actions in the actions menu (no backend wiring for these yet).

## Capabilities

### New Capabilities

- `mobile-recipe-detail-context`: Mobile recipe detail context wiring — creating and providing `RecipeDetailProvider` with all required adapter hooks for the mobile app.

### Modified Capabilities

- `mobile-recipe-live-data`: The recipe detail screen now uses live data from the backend instead of just dashboard/search surfaces.

## Impact

- **Code**: `apps/mobile/src/` — new context file, new hook re-exports, updated `[id].tsx` screen, all `recipe-detail/` components updated.
- **Dependencies**: Consumes `@norish/shared-react` (createRecipeDetailContext, createRecipeHooks), `@norish/shared/contracts` (FullRecipeDTO, RecipeIngredientsDto, StepStepSchema types).
- **No API changes**: All tRPC endpoints already exist and are consumed by the web app.
- **No breaking changes**: The mobile app is the only consumer of these components; the dashboard/search wiring remains untouched.
