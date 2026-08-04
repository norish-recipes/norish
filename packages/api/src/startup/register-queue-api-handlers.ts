import {
  deletePlannedItem,
  syncPlannedItem,
  truncateErrorMessage,
} from "@norish/api/caldav/sync-manager";
import { parseRecipeFromUrl } from "@norish/api/parser";
import { extractRecipeFromImages } from "@norish/api/parser/image-extraction";
import { extractRecipeNodesFromJsonValue } from "@norish/api/parser/jsonld";
import { normalizeRecipeFromJson, parseCategories, parseTags } from "@norish/api/parser/normalize";
import { extractRecipeWithAI } from "@norish/api/parser/recipe-extraction";
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
    syncPlannedItem,
    deletePlannedItem,
    truncateErrorMessage,
    cleanupOrphanedImages,
    cleanupOrphanedAvatars,
    cleanupOrphanedStepImages,
    cleanupOldTempFiles,
  });
}
