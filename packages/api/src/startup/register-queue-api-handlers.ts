import { detectAllergiesInRecipe } from "@norish/api/ai/allergy-detector";
import { categorizeRecipe } from "@norish/api/ai/auto-categorizer";
import { generateTagsForRecipe } from "@norish/api/ai/auto-tagger";
import { extractRecipeFromImages } from "@norish/api/ai/image-recipe-parser";
import { estimateNutritionFromIngredients } from "@norish/api/ai/nutrition-estimator";
import { extractRecipeWithAI } from "@norish/api/ai/recipe-parser";
import {
  deletePlannedItem,
  syncPlannedItem,
  truncateErrorMessage,
} from "@norish/api/caldav/sync-manager";
import { parseRecipeFromUrl } from "@norish/api/parser";
import { extractRecipeNodesFromJsonValue } from "@norish/api/parser/jsonld";
import { normalizeRecipeFromJson, parseCategories, parseTags } from "@norish/api/parser/normalize";
import {
  cleanupOrphanedAvatars,
  cleanupOrphanedImages,
  cleanupOrphanedStepImages,
} from "@norish/api/startup/media-cleanup";
import { cleanupOldTempFiles } from "@norish/api/video/cleanup";
import { registerQueueApiHandlers } from "@norish/queue/api-handlers";

export function registerApiHandlersForQueue(): void {
  registerQueueApiHandlers({
    extractRecipeNodesFromJsonValue,
    normalizeRecipeFromJson,
    parseCategories,
    parseTags,
    extractRecipeWithAI,
    parseRecipeFromUrl,
    extractRecipeFromImages,
    estimateNutritionFromIngredients,
    generateTagsForRecipe,
    categorizeRecipe,
    detectAllergiesInRecipe,
    syncPlannedItem,
    deletePlannedItem,
    truncateErrorMessage,
    cleanupOrphanedImages,
    cleanupOrphanedAvatars,
    cleanupOrphanedStepImages,
    cleanupOldTempFiles,
  });
}
