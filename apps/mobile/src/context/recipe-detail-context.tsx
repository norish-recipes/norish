import { useRecipesContext } from "@/context/recipes-context";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import {
  useAllergyDetection,
  useAllergyDetectionMutation,
  useAutoCategorization,
  useAutoCategorizationMutation,
  useAutoTagging,
  useAutoTaggingMutation,
  useConvertMutation,
  useFavoritesMutation,
  useNutritionMutation,
  useNutritionQuery,
  useNutritionSubscription,
  useRecipeQuery,
  useRecipeSubscription,
} from "@/hooks/recipes";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { useActiveAllergies } from "@/hooks/user";
import { TRPCClientError } from "@trpc/client";

import { createRecipeDetailContext } from "@norish/shared-react/hooks";

const { RecipeDetailProvider, useRecipeContext, useRecipeContextRequired } =
  createRecipeDetailContext({
    useRecipeQuery,
    useRecipeSubscription,
    useRecipeSharesQuery: sharedRecipeShareHooks.useRecipeSharesQuery,
    useRecipeShareSubscription: sharedRecipeShareHooks.useRecipeShareSubscription,
    useRecipeShareMutations: sharedRecipeShareHooks.useRecipeShareMutations,
    useNutritionQuery,
    useNutritionMutation,
    useNutritionSubscription,
    useAutoTaggingMutation,
    useAutoTagging,
    useAutoCategorizationMutation,
    useAutoCategorization,
    useAllergyDetectionMutation,
    useAllergyDetection,
    useActiveAllergies,
    useConvertMutation,
    useRatingQuery,
    useRatingsMutation,
    useFavoriteIds: () => {
      const { favoriteIds } = useRecipesContext();
      return favoriteIds;
    },
    useFavoritesMutation,
    isNotFoundError: (error: unknown) =>
      error instanceof TRPCClientError && error.data?.code === "NOT_FOUND",
  });

export { RecipeDetailProvider, useRecipeContext, useRecipeContextRequired };
