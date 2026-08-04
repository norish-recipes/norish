import type { ImageImportFile } from "@norish/queue/contracts/job-types";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { AIResponseError } from "@norish/shared-server/ai/runtime/errors";
import { generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import { aiLogger } from "@norish/shared-server/logger";

import type { RecipeExtractionOutput } from "./extraction.schema";
import {
  getExtractionLogContext,
  normalizeExtractionOutput,
  validateExtractionOutput,
} from "./extraction-normalizer";
import { recipeExtractionSchema } from "./extraction.schema";

// Re-export type for consumers
export type { RecipeExtractionOutput };

/**
 * Extract recipe from images using AI vision models.
 *
 * Runs under image extraction's own administrator-editable prompt — never a
 * rewritten copy of the webpage-extraction prompt.
 *
 * @param recipeId - Recipe ID allocated by the import entry point
 * @param files - Array of image files (base64 encoded)
 * @returns The extracted recipe; throws on AI failure or when the images hold no recipe.
 */
export async function extractRecipeFromImages(
  recipeId: string,
  files: ImageImportFile[]
): Promise<FullRecipeInsertDTO> {
  if (files.length === 0) {
    throw new Error("No images provided for recipe extraction");
  }

  aiLogger.info({ fileCount: files.length }, "Starting AI image recipe extraction");

  const jsonLd = await generateStructured({
    prompt: "image-extraction",
    schema: recipeExtractionSchema,
    // The images themselves select the vision model.
    images: files.map((file) => ({ data: file.data, mimeType: file.mimeType })),
  });

  // Images that hold no recipe are a domain outcome the schema cannot state.
  const validation = validateExtractionOutput(jsonLd);

  if (!validation.valid) {
    aiLogger.error(validation.details, validation.error);

    throw new AIResponseError(validation.error!);
  }

  aiLogger.debug(getExtractionLogContext(jsonLd, null), "AI vision response received");

  // Normalize using shared normalizer (no URL or images for image imports)
  const normalized = await normalizeExtractionOutput(jsonLd, { recipeId });

  if (!normalized) {
    aiLogger.error("Failed to normalize recipe from image extraction");

    throw new AIResponseError("Failed to normalize the extracted recipe data.");
  }

  aiLogger.info(
    getExtractionLogContext(jsonLd, normalized),
    "AI image recipe extraction completed"
  );

  return normalized;
}
