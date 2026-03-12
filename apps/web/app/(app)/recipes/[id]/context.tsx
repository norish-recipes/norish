"use client";

import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { createRecipeDetailContext } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useRecipesContext } from "@/context/recipes-context";
import { useFavoritesMutation } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import {
  useAllergyDetection,
  useAllergyDetectionMutation,
  useAutoCategorization,
  useAutoCategorizationMutation,
  useAutoTagging,
  useAutoTaggingMutation,
  useNutritionMutation,
  useNutritionQuery,
  useNutritionSubscription,
  useRecipeQuery,
  useRecipeSubscription,
} from "@/hooks/recipes";
import { useActiveAllergies } from "@/hooks/user";

const {
  RecipeDetailProvider: RecipeContextProvider,
  useRecipeContext,
  useRecipeContextRequired,
} = createRecipeDetailContext({
  useRecipeQuery,
  useRecipeSubscription,
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
  useConvertMutation: () => {
     
    const trpc = useTRPC();

     
    return useMutation(trpc.recipes.convertMeasurements.mutationOptions());
  },
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

export { RecipeContextProvider, useRecipeContext, useRecipeContextRequired };
