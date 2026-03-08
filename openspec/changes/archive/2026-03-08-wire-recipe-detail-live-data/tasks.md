## 1. Recipe Family Hook Re-exports

- [x] 1.1 Create `apps/mobile/src/hooks/recipes/use-recipe-query.ts` — re-export `sharedRecipeFamilyHooks.useRecipeQuery`
- [x] 1.2 Create `apps/mobile/src/hooks/recipes/use-recipe-subscription.ts` — re-export `sharedRecipeFamilyHooks.useRecipeSubscription`
- [x] 1.3 Create `apps/mobile/src/hooks/recipes/use-nutrition-query.ts` — re-export `sharedRecipeFamilyHooks.useNutritionQuery`
- [x] 1.4 Create `apps/mobile/src/hooks/recipes/use-nutrition-mutation.ts` — re-export `sharedRecipeFamilyHooks.useNutritionMutation`
- [x] 1.5 Create `apps/mobile/src/hooks/recipes/use-nutrition-subscription.ts` — re-export `sharedRecipeFamilyHooks.useNutritionSubscription`
- [x] 1.6 Create `apps/mobile/src/hooks/recipes/use-auto-tagging-mutation.ts` — re-export `sharedRecipeFamilyHooks.useAutoTaggingMutation`
- [x] 1.7 Create `apps/mobile/src/hooks/recipes/use-auto-tagging.ts` — re-export `sharedRecipeFamilyHooks.useAutoTagging`
- [x] 1.8 Create `apps/mobile/src/hooks/recipes/use-auto-categorization-mutation.ts` — re-export `sharedRecipeFamilyHooks.useAutoCategorizationMutation`
- [x] 1.9 Create `apps/mobile/src/hooks/recipes/use-auto-categorization.ts` — re-export `sharedRecipeFamilyHooks.useAutoCategorization`
- [x] 1.10 Create `apps/mobile/src/hooks/recipes/use-allergy-detection-mutation.ts` — re-export `sharedRecipeFamilyHooks.useAllergyDetectionMutation`
- [x] 1.11 Create `apps/mobile/src/hooks/recipes/use-allergy-detection.ts` — re-export `sharedRecipeFamilyHooks.useAllergyDetection`
- [x] 1.12 Update `apps/mobile/src/hooks/recipes/index.ts` — add all new hook exports
- [x] 1.13 Create `apps/mobile/src/hooks/user/use-active-allergies.ts` — create a `useActiveAllergies` hook (returns `{ allergies: string[], allergySet: Set<string> }`) using the user allergies query, matching the web's implementation

## 2. Mobile Recipe Detail Context

- [x] 2.1 Create `apps/mobile/src/context/recipe-detail-context.tsx` — call `createRecipeDetailContext` with mobile adapters (useRecipeQuery, useRecipeSubscription, useNutritionQuery, useNutritionMutation, useNutritionSubscription, useAutoTaggingMutation, useAutoTagging, useAutoCategorizationMutation, useAutoCategorization, useAllergyDetectionMutation, useAllergyDetection, useActiveAllergies, useConvertMutation, isNotFoundError), mirroring `apps/web/app/(app)/recipes/[id]/context.tsx`
- [x] 2.2 Export `RecipeDetailProvider`, `useRecipeContext`, `useRecipeContextRequired` from the new context file

## 3. Data Mapping Utilities

- [x] 3.1 Create `apps/mobile/src/lib/recipes/map-recipe-to-media-items.ts` — transform `FullRecipeDTO.image`, `.images`, `.videos` into the `MediaItem[]` array expected by `RecipeMediaHeader`, resolving relative URLs via `backendBaseUrl` and attaching auth headers
- [x] 3.2 Create `apps/mobile/src/lib/recipes/map-recipe-to-steps.ts` — transform `FullRecipeDTO.steps` (with `step`/`order`/`images` fields) into the shape expected by `RecipeSteps` (with `text` field), resolving step image URLs
- [x] 3.3 Create `apps/mobile/src/lib/recipes/resolve-image-url.ts` — shared utility to resolve a relative image URL against `backendBaseUrl` and build an `expo-image`-compatible source with auth headers (extract from existing `map-dashboard-recipe-to-card-item.ts` pattern)

## 4. Update Recipe Detail Components

- [x] 4.1 Update `RecipeIngredients` — change prop type from `DummyIngredient[]` to `RecipeIngredientsDto[]` (use `ingredientName` as display name, `amount` as nullable number, `unit` as string), remove import of `DummyIngredient`
- [x] 4.2 Update `RecipeSteps` — change prop type from `DummyStep[]` to the mapped step shape (or directly accept `StepStepSchema` items and use `step` field for text), update step image field references, remove import of `DummyStep`
- [x] 4.3 Update `RecipeNutrition` — change prop type from `DummyNutrition` to accept nullable `calories`, `fat`, `carbs`, `protein` number fields (directly from `FullRecipeDTO`), handle nullable values with defaults, remove import of `DummyNutrition`
- [x] 4.4 Update `RecipeMediaHeader` — change the `MediaItem` type to accommodate `FullRecipeDTO` images/videos (or keep internal type and accept pre-mapped data), update image source to use authenticated URI pattern
- [x] 4.5 Update `RecipeAuthor` — accept `AuthorDTO` (with `id`, `name`, `image`) instead of separate `name`/`initials` props, derive initials from author name
- [x] 4.6 Update `RecipeHighlights` — handle nullable time fields from `FullRecipeDTO`
- [x] 4.7 Update `RecipeTags` — no type change needed (already `string[]`), verify compatibility
- [x] 4.8 Update `RecipeRating` — wire to `useRatingQuery` (fetch current user rating) and `useRatingsMutation` (persist rating change), replace local `onRate` prop with backend mutation
- [x] 4.9 Update `RecipeLikedButton` — wire to `useFavoritesMutation` (toggle favorite), replace local `onToggle` prop with backend mutation, source `liked` state from `favoriteIds` set in `RecipesContext`
- [x] 4.10 Update `CookModeModal` — accept `RecipeIngredientsDto[]` and mapped step shape instead of `DummyIngredient[]`/`DummyStep[]`
- [x] 4.11 Update `CookModeIngredients` — accept `RecipeIngredientsDto[]` instead of `DummyIngredient[]`

## 5. Wire Recipe Detail Screen

- [x] 5.1 Update `[id].tsx` — import `RecipeDetailProvider` and `useRecipeContext` instead of `DUMMY_RECIPE`, wrap content in provider with route param `id`
- [x] 5.2 Extract inner content into a `RecipeDetailContent` component that calls `useRecipeContext()` to get recipe data, loading, error state
- [x] 5.3 Add loading state — render a spinner/skeleton when `isLoading` is true
- [x] 5.4 Add not-found state — render an error/not-found view when `isNotFound` is true
- [x] 5.5 Map `FullRecipeDTO` to component props — use mapping utilities to derive media items, steps, nutrition, author display props from the recipe context
- [x] 5.6 Wire servings to context — use `currentServings` and `setIngredientAmounts` from context instead of local `useState`
- [x] 5.7 Wire `adjustedIngredients` from context into `RecipeIngredients` and `CookModeModal`

## 6. Cleanup

- [x] 6.1 Delete `apps/mobile/src/components/recipe-detail/dummy-data.ts`
- [x] 6.2 Verify no remaining imports of `dummy-data.ts`, `DummyRecipe`, `DummyIngredient`, `DummyStep`, `DummyNutrition`, or `MediaItem` from dummy-data
- [x] 6.3 Verify TypeScript compilation succeeds with `tsc --noEmit` across the mobile app
- [x] 6.4 Verify the recipe detail screen loads a real recipe from the backend on device/simulator
