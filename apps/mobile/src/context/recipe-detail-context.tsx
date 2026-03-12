import { useMutation } from '@tanstack/react-query';
import { TRPCClientError } from '@trpc/client';

import { createRecipeDetailContext } from '@norish/shared-react/hooks';

import {
  useAllergyDetection,
  useAllergyDetectionMutation,
  useAutoCategorization,
  useAutoCategorizationMutation,
  useAutoTagging,
  useAutoTaggingMutation,
  useFavoritesMutation,
  useNutritionMutation,
  useNutritionQuery,
  useNutritionSubscription,
  useRecipeQuery,
  useRecipeSubscription,
} from '@/hooks/recipes';
import { useRatingQuery, useRatingsMutation } from '@/hooks/ratings';
import { useActiveAllergies } from '@/hooks/user';
import { useRecipesContext } from '@/context/recipes-context';
import { useTRPC } from '@/providers/trpc-provider';

const {
  RecipeDetailProvider,
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
    error instanceof TRPCClientError && error.data?.code === 'NOT_FOUND',
});

export { RecipeDetailProvider, useRecipeContext, useRecipeContextRequired };

