import type { CreateRecipeHooksOptions } from "../types";
import { createUseAllergyDetectionQuery } from "./use-allergy-detection-query";
import {
  createUseAllergyDetection,
  createUseAllergyDetectionMutation,
} from "./use-allergy-detection-subscription";
import {
  createUseAutoCategorization,
  createUseAutoCategorizationMutation,
} from "./use-auto-categorization-subscription";
import { createUseAutoTaggingQuery } from "./use-auto-tagging-query";
import {
  createUseAutoTagging,
  createUseAutoTaggingMutation,
} from "./use-auto-tagging-subscription";
import { createUseConvertMutation } from "./use-convert-mutation";
import { createUseNutritionMutation } from "./use-nutrition-mutation";
import { createUseNutritionQuery } from "./use-nutrition-query";
import { createUseNutritionSubscription } from "./use-nutrition-subscription";
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

export {
  createUseRecipeId,
  createUseRecipeQuery,
  createUseAutoTaggingQuery,
  createUseAllergyDetectionQuery,
  createUseNutritionQuery,
  createUseAutoTagging,
  createUseAutoTaggingMutation,
  createUseAutoCategorization,
  createUseAutoCategorizationMutation,
  createUseAllergyDetection,
  createUseAllergyDetectionMutation,
  createUseConvertMutation,
  createUseNutritionSubscription,
  createUseNutritionMutation,
  createUseRecipeSubscription,
  createUseRecipeImages,
  createUseRecipeVideos,
  createUseRecipeIngredients,
};

export function createRecipeFamilyHooks(options: CreateRecipeHooksOptions) {
  const useRecipeId = createUseRecipeId(options);
  const useRecipeQuery = createUseRecipeQuery(options);
  const useRecipeSubscription = createUseRecipeSubscription(options, { useRecipeQuery });

  return {
    useRecipeId,
    useRecipeQuery,
    useRecipeSubscription,
    useRecipeImages: createUseRecipeImages(options),
    useRecipeVideos: createUseRecipeVideos(options),
    useAutoTaggingQuery: createUseAutoTaggingQuery(options),
    useAllergyDetectionQuery: createUseAllergyDetectionQuery(options),
    useNutritionQuery: createUseNutritionQuery(options),
    useAutoTagging: createUseAutoTagging(options),
    useAutoTaggingMutation: createUseAutoTaggingMutation(options),
    useAutoCategorization: createUseAutoCategorization(options),
    useAutoCategorizationMutation: createUseAutoCategorizationMutation(options),
    useAllergyDetection: createUseAllergyDetection(options),
    useAllergyDetectionMutation: createUseAllergyDetectionMutation(options),
    useConvertMutation: createUseConvertMutation(options),
    useNutritionSubscription: createUseNutritionSubscription(options),
    useNutritionMutation: createUseNutritionMutation(options),
    useRecipeIngredients: createUseRecipeIngredients(useRecipeQuery),
  };
}
