import type { CreateRecipeHooksOptions } from "../types";
import {
  useConvertMutation,
  useLinkedRecipeIngredients,
  useRecipeEnrichment,
  useRecipeId,
  useRecipeImages,
  useRecipeIngredients,
  useRecipeQuery,
  useRecipeSubscription,
  useRecipeVideos,
} from "../../../recipes";

export type {
  ConvertMutationResult,
  RecipeEnrichmentCallbacks,
  RecipeEnrichmentResult,
  RecipeEnrichmentStateMap,
  RecipeIdResult,
  RecipeQueryResult,
  RecipeSubscriptionCallbacks,
} from "../../../recipes";

export function createRecipeFamilyHooks(_options: CreateRecipeHooksOptions) {
  return {
    useRecipeId,
    useRecipeQuery,
    useRecipeSubscription,
    useRecipeImages,
    useRecipeVideos,
    useRecipeEnrichment,
    useConvertMutation,
    useRecipeIngredients,
    useLinkedRecipeIngredients,
  };
}
