## Context

The mobile recipe detail page (`apps/mobile/src/app/(tabs)/dashboard/recipe/[id].tsx`) currently imports `DUMMY_RECIPE` from a local `dummy-data.ts` file with bespoke `Dummy*` types. All UI components (`RecipeIngredients`, `RecipeSteps`, `RecipeNutrition`, `RecipeMediaHeader`, `RecipeRating`, `RecipeLikedButton`, `RecipeAuthor`, `RecipeHighlights`, `RecipeTags`) consume these dummy types.

The shared infrastructure is already in place:

- `@norish/shared-react` exports `createRecipeDetailContext` (factory) and `createRecipeHooks` (hooks factory)
- The mobile app already uses `createRecipeHooks` for dashboard hooks (`sharedDashboardRecipeHooks`) but does **not** re-export the `recipe` family hooks
- The web app has a working reference implementation at `apps/web/app/(app)/recipes/[id]/context.tsx`
- tRPC endpoints for recipe CRUD, subscriptions, ratings, favorites, nutrition, auto-tagging, allergy detection, and measurement conversion all exist

## Goals / Non-Goals

**Goals:**

- Replace dummy data with live backend data using the shared `RecipeDetailProvider` pattern
- Re-export all `sharedRecipeFamilyHooks` members as individual mobile hook files
- Create a mobile `RecipeDetailProvider` context with full adapter wiring
- Update all recipe-detail components to accept `FullRecipeDTO`-shaped data
- Add loading/error/not-found states to the recipe detail screen
- Wire rating and favorites to persisted backend mutations
- Build authenticated image URIs for recipe images (relative → absolute with auth)
- Remove `dummy-data.ts`

**Non-Goals:**

- Wiring add-to-groceries or add-to-calendar actions (leave as placeholders)
- Changing the visual design or layout of any component
- Modifying the cook mode behavior (it already works with any steps/ingredients shape)
- Adding new tRPC endpoints or modifying the backend

## Decisions

### 1. Use `createRecipeDetailContext` factory (same as web)

**Decision**: Create a mobile `recipe-detail-context.tsx` that calls `createRecipeDetailContext` with mobile-specific adapters, exactly mirroring `apps/web/app/(app)/recipes/[id]/context.tsx`.

**Rationale**: This is the established pattern. The factory handles servings adjustment, ingredient scaling, measurement conversion, nutrition estimation, auto-tagging, and allergy detection — all already battle-tested on web.

**Alternative considered**: Build a lighter context that only provides the recipe query. Rejected because we'd lose ingredient scaling, conversion, and nutrition estimation for free.

### 2. Re-export recipe family hooks as individual files

**Decision**: Create individual hook files under `apps/mobile/src/hooks/recipes/` (e.g., `use-recipe-query.ts`, `use-recipe-subscription.ts`, `use-nutrition-query.ts`, etc.) that re-export from `sharedRecipeFamilyHooks`, following the identical pattern already used for dashboard hooks.

**Rationale**: Consistent with the existing codebase pattern. Each dashboard hook (`use-recipes-query.ts`, `use-favorites-query.ts`, etc.) is a one-liner re-export. This keeps imports clean and makes it easy to add mobile-specific overrides later.

### 3. Map `FullRecipeDTO` fields to component props via a mapping layer

**Decision**: Create a `map-recipe-to-detail-props.ts` utility that transforms `FullRecipeDTO` fields into the shapes each component expects (media items, ingredient display, etc.) rather than making each component understand `FullRecipeDTO` directly.

Key mappings:

- `recipe.image` + `recipe.images` + `recipe.videos` → `MediaItem[]` (order: video first if present, then gallery images, then primary image as fallback)
- `recipe.recipeIngredients` → filtered by `systemUsed`, mapped to display shape with `ingredientName` as the name field
- `recipe.steps` → mapped from `{ step, order, images }` to the component's expected shape with `text` field
- `recipe.calories/fat/carbs/protein` → nutrition object (all nullable)
- `recipe.author` → author display props
- Image URLs: relative paths resolved against `backendBaseUrl`

**Rationale**: Keeps components decoupled from the DTO shape. If the API changes, only the mapping layer needs updating.

### 4. Authenticated image URIs

**Decision**: Use the same `resolveImageUrl` pattern from `map-dashboard-recipe-to-card-item.ts` — prepend `backendBaseUrl` to relative image paths and pass auth cookies via `headers` on `expo-image` sources.

**Rationale**: This pattern is already proven for dashboard recipe card images. The same auth context (`useAuth`) provides `backendBaseUrl` and `authClient`.

### 5. Rating and favorites wiring

**Decision**: Wire `RecipeRating` to `useRatingQuery` + `useRatingsMutation` from `@norish/shared-react/hooks/ratings`. Wire `RecipeLikedButton` to `useFavoritesMutation` from the existing dashboard hooks, using the `favoriteIds` set from `useRecipesContext`.

**Rationale**: Both hook families already exist and are consumed on web. Ratings are per-recipe mutations; favorites are dashboard-level but the mutation can be called from anywhere.

### 6. Wrap `[id].tsx` with `RecipeDetailProvider`

**Decision**: The `[id].tsx` screen component wraps its content in `<RecipeDetailProvider recipeId={id}>` using the route param `id` from `useLocalSearchParams`. Inside the provider, a child component calls `useRecipeContext()` to get `recipe`, `isLoading`, `error`, `isNotFound`, `adjustedIngredients`, `currentServings`, `setIngredientAmounts`.

**Rationale**: This follows the web pattern exactly. The provider handles all data fetching and subscription lifecycle.

## Risks / Trade-offs

- **Image auth token expiry** → Images may fail to load if the auth cookie expires mid-session. Mitigation: expo-image has built-in retry; the auth context refreshes tokens automatically.
- **Large component refactor surface** → Touching 10+ components at once. Mitigation: Changes are mechanical (type replacement + field name mapping); each component's visual output remains identical. Testing by visual inspection on device.
- **Missing recipe data fields** → Some recipes may have null `prepMinutes`, `cookMinutes`, `author`, etc. Mitigation: All components already handle optional fields with null checks; the dummy data had all fields populated, but the components use conditional rendering.
- **No offline support** → Recipe detail shows a loading state if network is unavailable. Mitigation: React Query's built-in cache provides fast re-renders for previously loaded recipes. Full offline support is a separate initiative.
