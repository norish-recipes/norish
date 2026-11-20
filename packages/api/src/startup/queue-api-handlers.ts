import type { QueueApiHandlers } from "@norish/queue/api-handlers";
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
import { fetchStorePage } from "@norish/api/parser/store-fetch";
import { readProduct, readSearchResults } from "@norish/api/parser/store-page";
import { discoverSearchAddress, verifySearchAddress } from "@norish/api/parser/store-search";
import {
  cleanupOrphanedAvatars,
  cleanupOrphanedImages,
  cleanupOrphanedStepImages,
} from "@norish/api/startup/media-cleanup";
import { cleanupOldTempFiles } from "@norish/api/video/cleanup";

/** Loaded by the first queue job that needs one: see register-queue-api-handlers. */
export const queueApiHandlers: QueueApiHandlers = {
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
  discoverSearchAddress,
  verifySearchAddress,
  fetchStorePage,
  readSearchResults,
  readProduct,
};
