import { generateText, Output } from "ai";

import { getModels, getGenerationSettings } from "./providers/registry";
import { recipeExtractionSchema, type RecipeExtractionOutput } from "./schemas/recipe.schema";
import { loadPrompt } from "./prompts/loader";
import { aiSuccess, aiError, mapErrorToCode, getErrorMessage, type AIResult } from "./types/result";

import type { ImageImportFile } from "@/types/dto/queue";
import type { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { normalizeRecipeFromJson } from "@/server/parser/normalize";
import { isAIEnabled, getUnits } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

// Re-export type for consumers
export type { RecipeExtractionOutput };

/**
 * Build the prompt for image-based recipe extraction.
 */
async function buildImageExtractionPrompt(allergies?: string[]): Promise<string> {
  const basePrompt = await loadPrompt("recipe-extraction");

  // Modify prompt for image context
  const imagePrompt = basePrompt
    .replace(
      "You will receive the contents of a webpage or video transcript",
      "You will receive images of a recipe (such as photos of a cookbook, printed recipe, or recipe card)"
    )
    .replace("reads website data", "reads recipe images");

  // Build allergy detection instruction
  let allergyInstruction = "";

  if (allergies && allergies.length > 0) {
    allergyInstruction = `\nALLERGY DETECTION: Only detect these specific allergens/dietary tags from the ingredients: ${allergies.join(", ")}. Do not add any other allergy tags.`;
  } else {
    allergyInstruction =
      "\nALLERGY DETECTION: Skip allergy/dietary tag detection. Do not add any tags to the keywords array.";
  }

  return `${imagePrompt}${allergyInstruction}

Analyze the provided images and extract the complete recipe data. If multiple images are provided, they represent different pages/parts of the same recipe - combine them into a single complete recipe.`;
}

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
 * @param files - Array of image files (base64 encoded)
 * @param allergies - Optional list of allergens to detect
 * @returns AIResult with extracted recipe or error
 */
export async function extractRecipeFromImages(
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

    if (!jsonLd || Object.keys(jsonLd).length === 0) {
      aiLogger.error("Empty or null response from AI vision provider");
      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    aiLogger.debug(
      {
        recipeName: jsonLd.name,
        metricIngredients: jsonLd.recipeIngredient?.metric?.length ?? 0,
        usIngredients: jsonLd.recipeIngredient?.us?.length ?? 0,
        metricSteps: jsonLd.recipeInstructions?.metric?.length ?? 0,
        usSteps: jsonLd.recipeInstructions?.us?.length ?? 0,
      },
      "AI vision response received"
    );

    // Validate required fields
    if (
      !jsonLd.name ||
      !jsonLd.recipeIngredient?.metric?.length ||
      !jsonLd.recipeIngredient?.us?.length ||
      !jsonLd.recipeInstructions?.metric?.length ||
      !jsonLd.recipeInstructions?.us?.length
    ) {
      aiLogger.error("Invalid recipe data from images - missing required fields");
      return aiError("Recipe extraction failed - missing required fields", "VALIDATION_ERROR");
    }

    // Use metric version for primary normalization
    const metricVersion = {
      ...jsonLd,
      recipeIngredient: jsonLd.recipeIngredient.metric,
      recipeInstructions: jsonLd.recipeInstructions.metric,
    };

    const normalized = await normalizeRecipeFromJson(metricVersion);

    if (!normalized) {
      aiLogger.error("Failed to normalize recipe from image extraction");
      return aiError("Failed to normalize recipe data", "VALIDATION_ERROR");
    }

    // Parse US ingredients and steps
    const units = await getUnits();
    const usIngredients = parseIngredientWithDefaults(jsonLd.recipeIngredient.us, units);
    const usSteps = jsonLd.recipeInstructions.us.map((step: string, i: number) => ({
      step,
      order: i + 1,
      systemUsed: "us" as const,
    }));

    // Combine both systems (no URL for image imports)
    normalized.url = null;
    normalized.recipeIngredients = [
      ...(normalized.recipeIngredients ?? []), // metric from normalizer
      ...usIngredients.map((ing, i) => ({
        ingredientId: null,
        ingredientName: ing.description,
        amount: ing.quantity != null ? ing.quantity : null,
        unit: ing.unitOfMeasureID,
        systemUsed: "us" as const,
        order: i,
      })),
    ];
    normalized.steps = [
      ...(normalized.steps ?? []), // metric from normalizer
      ...usSteps,
    ];

    aiLogger.info(
      {
        recipeName: normalized.name,
        totalIngredients: normalized.recipeIngredients?.length ?? 0,
        totalSteps: normalized.steps?.length ?? 0,
        systemUsed: normalized.systemUsed,
        tags: normalized.tags,
      },
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
