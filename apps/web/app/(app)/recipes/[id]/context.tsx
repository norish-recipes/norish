"use client";

import { useRecipesContext } from "@/context/recipes-context";
import { useFavoritesMutation } from "@/hooks/favorites";
import { useRatingQuery, useRatingsMutation } from "@/hooks/ratings";
import {
  useConvertMutation,
  useRecipeEnrichment,
  useRecipeEnrichmentSubscription,
  useRecipeQuery,
  useRecipeSubscription,
} from "@/hooks/recipes";
import { sharedRecipeShareHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { TRPCClientError } from "@trpc/client";

import { createRecipeDetailContext } from "@norish/shared-react/hooks";
import { useActiveAllergies } from "@norish/shared-react/reader";

const {
  RecipeDetailProvider: RecipeContextProvider,
  useRecipeContext,
  useRecipeContextRequired,
} = createRecipeDetailContext({
  useRecipeQuery,
  useRecipeSubscription,
  useRecipeSharesQuery: sharedRecipeShareHooks.useRecipeSharesQuery,
  useRecipeShareSubscription: sharedRecipeShareHooks.useRecipeShareSubscription,
  useRecipeShareMutations: sharedRecipeShareHooks.useRecipeShareMutations,
  useRecipeEnrichment: (recipeId: string) => {
    useRecipeEnrichmentSubscription(recipeId);

    return useRecipeEnrichment(recipeId);
  },
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

export { RecipeContextProvider, useRecipeContext, useRecipeContextRequired };
