import { generateText, Output } from "ai";

import type { ImageImportFile } from "@norish/queue/contracts/job-types";
import type { AIResult } from "@norish/shared-server/ai/types/result";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { isAIEnabled } from "@norish/config/server-config-loader";
import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import {
  aiError,
  aiSuccess,
  getErrorMessage,
  mapErrorToCode,
} from "@norish/shared-server/ai/types/result";
import { aiLogger } from "@norish/shared-server/logger";

import type { RecipeExtractionOutput } from "./schemas/recipe.schema";
import {
  getExtractionLogContext,
  normalizeExtractionOutput,
  validateExtractionOutput,
} from "./features/recipe-extraction/normalizer";
import { buildImageExtractionPrompt } from "./prompts/builder";
import { recipeExtractionSchema } from "./schemas/recipe.schema";

// Re-export type for consumers
export type { RecipeExtractionOutput };

/**
 * Build message content parts including text prompt and images.
 */
function buildImageMessageContent(prompt: string, files: ImageImportFile[]) {
  const content: Array<
    { type: "text"; text: string } | { type: "image"; image: string; mediaType: string }
  > = [{ type: "text", text: prompt }];

  // Add each image as a content part
  for (const file of files) {
    content.push({
      type: "image",
      image: file.data, // base64 encoded data
      mediaType: file.mimeType,
    });
  }

  return content;
}

/**
 * Extract recipe from images using AI vision models.
 *
 * @param recipeId - Recipe ID allocated by the import entry point
 * @param files - Array of image files (base64 encoded)
 * @param allergies - Optional list of allergens to detect
 * @returns AIResult with extracted recipe or error
 */
export async function extractRecipeFromImages(
  recipeId: string,
  files: ImageImportFile[],
  allergies?: string[]
): Promise<AIResult<FullRecipeInsertDTO>> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping image extraction");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  if (files.length === 0) {
    aiLogger.warn("No images provided for recipe extraction");

    return aiError("No images provided", "INVALID_INPUT");
  }

  aiLogger.info({ fileCount: files.length }, "Starting AI image recipe extraction");

  try {
    const { visionModel, providerName } = await getModels();
    const settings = await getGenerationSettings();

    // Build prompt using shared builder
    const prompt = await buildImageExtractionPrompt(allergies);

    aiLogger.debug(
      { fileCount: files.length, filenames: files.map((f) => f.filename), provider: providerName },
      "Sending images to AI vision provider"
    );

    // Build messages with image content parts
    const messages = [
      {
        role: "user" as const,
        content: buildImageMessageContent(prompt, files),
      },
    ];

    const result = await generateText({
      model: visionModel,
      output: Output.object({ schema: recipeExtractionSchema }),
      messages,
      system:
        "You extract recipe data from images as JSON-LD with both metric and US measurements. Return valid JSON only.",
      ...settings,
    });

    const jsonLd = result.output;

    // Validate extraction output
    const validation = validateExtractionOutput(jsonLd);

    if (!validation.valid) {
      aiLogger.error(validation.details, validation.error);

      return aiError(validation.error!, "VALIDATION_ERROR");
    }

    aiLogger.debug(getExtractionLogContext(jsonLd!, null), "AI vision response received");

    // Normalize using shared normalizer (no URL or images for image imports)
    const normalized = await normalizeExtractionOutput(jsonLd!, { recipeId });

    if (!normalized) {
      aiLogger.error("Failed to normalize recipe from image extraction");

      return aiError("Failed to normalize recipe data", "VALIDATION_ERROR");
    }

    aiLogger.info(
      getExtractionLogContext(jsonLd!, normalized),
      "AI image recipe extraction completed"
    );

    return aiSuccess(normalized, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error(
      { err: error, fileCount: files.length, code },
      "Failed to extract recipe from images"
    );

    return aiError(message, code);
  }
}
