import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import {
  getExtractionLogContext,
  normalizeExtractionOutput,
  validateExtractionOutput,
} from "@norish/api/parser/extraction-normalizer";
import { buildVideoExtractionSections } from "@norish/api/parser/extraction-prompts";
import { recipeExtractionSchema } from "@norish/api/parser/extraction.schema";
import { AIResponseError } from "@norish/shared-server/ai/runtime/errors";
import { generateStructured } from "@norish/shared-server/ai/runtime/runtime";
import { videoLogger } from "@norish/shared-server/logger";
import { downloadImage } from "@norish/shared-server/media/storage";

import type { VideoMetadata } from "./types";

/**
 * Extract recipe from video transcript using AI.
 *
 * Runs under the recipe-extraction prompt with transcript sections appended.
 *
 * @param transcript - The video transcript text.
 * @param metadata - Video metadata (title, description, duration, etc.).
 * @param url - Source URL of the video.
 * @returns The extracted recipe; throws on AI failure or when the video holds no recipe.
 */
export async function extractRecipeFromVideo(
  transcript: string,
  metadata: VideoMetadata,
  recipeId: string,
  url: string
): Promise<FullRecipeInsertDTO> {
  videoLogger.info({ url, title: metadata.title }, "Starting AI video recipe extraction");

  const jsonLd = await generateStructured({
    prompt: "recipe-extraction",
    schema: recipeExtractionSchema,
    sections: buildVideoExtractionSections(transcript, {
      url,
      title: metadata.title,
      description: metadata.description,
      duration: metadata.duration,
      uploader: metadata.uploader,
    }),
  });

  // A video that holds no recipe is a domain outcome the schema cannot state.
  const validation = validateExtractionOutput(jsonLd);

  if (!validation.valid) {
    videoLogger.error({ url, ...validation.details }, validation.error);

    throw new AIResponseError(validation.error!);
  }

  videoLogger.debug(
    { url, ...getExtractionLogContext(jsonLd, null) },
    "AI video response received"
  );

  // Download thumbnail as recipe image if available
  let thumbnailPath: string | undefined;

  if (metadata.thumbnail) {
    try {
      thumbnailPath = await downloadImage(metadata.thumbnail, recipeId);
    } catch (_error) {
      // Continue without image rather than failing
      videoLogger.debug({ url }, "Failed to download video thumbnail");
    }
  }

  // Normalize using shared normalizer
  const normalized = await normalizeExtractionOutput(jsonLd, {
    url,
    image: thumbnailPath,
    recipeId,
  });

  if (!normalized) {
    videoLogger.error({ url }, "Failed to normalize recipe from JSON-LD");

    throw new AIResponseError("Failed to normalize the extracted recipe data.");
  }

  videoLogger.info(
    { url, ...getExtractionLogContext(jsonLd, normalized) },
    "Video recipe extraction completed"
  );

  return normalized;
}
