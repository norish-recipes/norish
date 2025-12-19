/**
 * Image Recipe Parser
 *
 * Extracts recipes from images using AI vision models.
 * Reuses the same recipe extraction schema and normalization as URL parsing.
 */

import type { ImageImportFile } from "@/types/dto/queue";

import { getAIProvider } from "./providers/factory";
import { jsonLdRecipeSchema } from "./schemas/jsonld-recipe";
import { loadPrompt } from "./prompts/loader";

import { FullRecipeInsertDTO } from "@/types/dto/recipe";
import { parseIngredientWithDefaults } from "@/lib/helpers";
import { normalizeRecipeFromJson } from "@/lib/parser/normalize";
import { getUnits, isAIEnabled } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

/**
 * Build the prompt for image-based recipe extraction
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
 * Extract recipe from images using AI vision models.
 *
 * @param files Array of image files (base64 encoded)
 * @param allergies Optional list of allergens to detect
 * @returns Parsed recipe or null if extraction fails
 */
export async function extractRecipeFromImages(
  files: ImageImportFile[],
  allergies?: string[]
): Promise<FullRecipeInsertDTO | null> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping image extraction");

    return null;
  }

  aiLogger.info({ fileCount: files.length }, "Starting AI image recipe extraction");

  const provider = await getAIProvider();
  const prompt = await buildImageExtractionPrompt(allergies);

  // Convert files to image inputs
  const images = files.map((f) => ({
    data: f.data,
    mimeType: f.mimeType,
  }));

  aiLogger.debug(
    { fileCount: files.length, filenames: files.map((f) => f.filename) },
    "Sending images to AI vision provider"
  );

  const jsonLd = await provider.generateFromImages<any>(
    images,
    prompt,
    jsonLdRecipeSchema,
    "You extract recipe data from images as JSON-LD with both metric and US measurements. Return {} if insufficient data."
  );

  if (!jsonLd || Object.keys(jsonLd).length === 0) {
    aiLogger.error("Empty or null response from AI vision provider");

    return null;
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

  if (
    !jsonLd.name ||
    !jsonLd.recipeIngredient?.metric?.length ||
    !jsonLd.recipeIngredient?.us?.length ||
    !jsonLd.recipeInstructions?.metric?.length ||
    !jsonLd.recipeInstructions?.us?.length
  ) {
    aiLogger.error("Invalid recipe data from images - missing required fields");

    return null;
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

    return null;
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

  return normalized;
}
