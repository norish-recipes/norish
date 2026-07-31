import type { CreateRecipeHooksOptions } from "../types";
import { createUseConvertMutation } from "./use-convert-mutation";
import { createUseLinkedRecipeIngredients } from "./use-linked-recipe-ingredients";
import { createUseRecipeEnrichment } from "./use-recipe-enrichment";
import { createUseRecipeId } from "./use-recipe-id";
import { createUseRecipeImages } from "./use-recipe-images";
import { createUseRecipeIngredients } from "./use-recipe-ingredients";
import { createUseRecipeQuery } from "./use-recipe-query";
import { createUseRecipeSubscription } from "./use-recipe-subscription";
import { createUseRecipeVideos } from "./use-recipe-videos";

export type { RecipeIdResult } from "./use-recipe-id";
export type { RecipeQueryResult } from "./use-recipe-query";
export type { RecipeSubscriptionCallbacks } from "./use-recipe-subscription";
export type { ConvertMutationResult } from "./use-convert-mutation";
export type {
  RecipeEnrichmentCallbacks,
  RecipeEnrichmentResult,
  RecipeEnrichmentStateMap,
} from "./use-recipe-enrichment";

export {
  createUseRecipeId,
  createUseRecipeQuery,
  createUseConvertMutation,
  createUseRecipeEnrichment,
  createUseRecipeSubscription,
  createUseRecipeImages,
  createUseRecipeVideos,
  createUseRecipeIngredients,
  createUseLinkedRecipeIngredients,
};

export function createRecipeFamilyHooks(options: CreateRecipeHooksOptions) {
  const useRecipeId = createUseRecipeId();
  const useRecipeQuery = createUseRecipeQuery(options);
  const useRecipeSubscription = createUseRecipeSubscription(options, { useRecipeQuery });

  return {
    useRecipeId,
    useRecipeQuery,
    useRecipeSubscription,
    useRecipeImages: createUseRecipeImages(options),
    useRecipeVideos: createUseRecipeVideos(options),
    useRecipeEnrichment: createUseRecipeEnrichment(options),
    useConvertMutation: createUseConvertMutation(options),
    useRecipeIngredients: createUseRecipeIngredients(useRecipeQuery),
    useLinkedRecipeIngredients: createUseLinkedRecipeIngredients(options),
  };
}
