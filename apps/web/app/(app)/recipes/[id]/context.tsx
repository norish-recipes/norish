"use client";

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
import { useTRPC } from "@/app/providers/trpc-provider";
import { useMutation } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";

import { createRecipeDetailContext } from "@norish/shared-react/hooks/recipe-detail";

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
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const trpc = useTRPC();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useMutation(trpc.recipes.convertMeasurements.mutationOptions());
  },
  isNotFoundError: (error: unknown) =>
    error instanceof TRPCClientError && error.data?.code === "NOT_FOUND",
});

export { RecipeContextProvider, useRecipeContext, useRecipeContextRequired };
