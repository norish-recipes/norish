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
import { buildRecipeExtractionSections } from "./extraction-prompts";
import { extractSanitizedBody } from "./extraction-sanitizer";
import { recipeExtractionSchema } from "./extraction.schema";
import { extractImageCandidates } from "./parsers";

// Re-export type for consumers
export type { RecipeExtractionOutput };

/**
 * Extract recipe from HTML content using AI.
 *
 * @param html - The HTML content to extract recipe from.
 * @param url - Optional source URL of the recipe.
 * @returns The extracted recipe; throws on AI failure or when the page holds no recipe.
 */
export async function extractRecipeWithAI(
  html: string,
  recipeId: string,
  url?: string,
  originalHtml?: string
): Promise<FullRecipeInsertDTO> {
  aiLogger.info({ url }, "Starting AI recipe extraction");

  // Sanitize and truncate HTML content
  const sanitized = extractSanitizedBody(html);
  const truncated = sanitized.slice(0, 50000);

  const jsonLd = await generateStructured({
    prompt: "recipe-extraction",
    schema: recipeExtractionSchema,
    sections: buildRecipeExtractionSections(truncated, { url }),
  });

  // A page that holds no recipe is a domain outcome the schema cannot state:
  // the model may answer with an empty shell, and storing one would be worse
  // than failing.
  const validation = validateExtractionOutput(jsonLd);

  if (!validation.valid) {
    aiLogger.error({ url, ...validation.details }, validation.error);

    throw new AIResponseError(validation.error!);
  }

  aiLogger.debug({ url, ...getExtractionLogContext(jsonLd, null) }, "AI response received");

  // Extract image candidates from HTML
  const imageCandidates = extractImageCandidates(originalHtml ?? html, url);

  // Normalize using shared normalizer
  const normalized = await normalizeExtractionOutput(jsonLd, {
    url,
    imageCandidates,
    recipeId,
  });

  if (!normalized) {
    aiLogger.error({ url }, "Failed to normalize recipe from JSON-LD");

    throw new AIResponseError("Failed to normalize the extracted recipe data.");
  }

  aiLogger.info(
    { url, ...getExtractionLogContext(jsonLd, normalized) },
    "AI recipe extraction completed"
  );

  return normalized;
}
