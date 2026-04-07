/**
 * Allergy Detector
 *
 * AI-based detection of allergens in recipe ingredients.
 * Only detects allergens from the provided list (household allergies).
 */

import { generateText, Output } from "ai";
import { z } from "zod";

import { getAIConfig, isAIEnabled } from "@norish/config/server-config-loader";
import { getGenerationSettings, getModels } from "@norish/shared-server/ai/providers";
import { aiLogger } from "@norish/shared-server/logger";

import type { AIResult } from "./core/types";
import { aiError, aiSuccess, getErrorMessage, mapErrorToCode } from "./core/types";

/**
 * Schema for allergy detection response.
 */
const allergyDetectionSchema = z
  .object({
    detectedAllergens: z
      .array(z.string())
      .describe(
        "Array of allergen names detected in the recipe. Only include allergens from the provided list that are actually present in the ingredients."
      ),
  })
  .strict();

export type AllergyDetectionOutput = z.infer<typeof allergyDetectionSchema>;

/**
 * Recipe data required for allergy detection.
 */
export interface RecipeForAllergyDetection {
  title: string;
  description?: string | null;
  ingredients: string[];
}

/**
 * Build the allergy detection prompt.
 */
function buildAllergyDetectionPrompt(
  recipe: RecipeForAllergyDetection,
  allergiesToDetect: string[]
): string {
  const ingredientList = recipe.ingredients.join("\n- ");
  const allergenList = allergiesToDetect.join(", ");

  return `Analyze this recipe and detect which allergens from the provided list are present in the ingredients.

RECIPE TITLE: ${recipe.title}
${recipe.description ? `DESCRIPTION: ${recipe.description}` : ""}

INGREDIENTS:
- ${ingredientList}

ALLERGENS TO DETECT: ${allergenList}

INSTRUCTIONS:
1. Carefully analyze each ingredient for the presence of allergens from the list above.
2. Consider both explicit mentions (e.g., "wheat flour" contains gluten) and implicit allergens (e.g., "soy sauce" contains soy and often wheat/gluten).
3. Only return allergens from the provided list that are actually present in the ingredients.
4. If no allergens from the list are detected, return an empty array.
5. Use the exact allergen names from the provided list (case-insensitive matching is fine, but return them as provided).

Return ONLY allergens that are definitely present based on the ingredients. Do not guess or assume.`;
}

/**
 * Detect allergens in a recipe using AI.
 *
 * @param recipe - The recipe data to analyze
 * @param allergiesToDetect - List of allergen names to look for (from household configuration)
 * @returns AIResult with array of detected allergen names, or error
 */
export async function detectAllergiesInRecipe(
  recipe: RecipeForAllergyDetection,
  allergiesToDetect: string[]
): Promise<AIResult<string[]>> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping allergy detection");

    return aiError("AI features are disabled", "AI_DISABLED");
  }

  // Guard: autoTagAllergies must be enabled
  const aiConfig = await getAIConfig();

  if (!aiConfig?.autoTagAllergies) {
    aiLogger.info("Allergy detection is disabled");

    return aiError("Allergy detection is disabled", "AI_DISABLED");
  }

  // Guard: Must have allergens to detect
  if (allergiesToDetect.length === 0) {
    aiLogger.info("No allergens to detect");

    return aiSuccess([]);
  }

  // Guard: Must have ingredients to analyze
  if (recipe.ingredients.length === 0) {
    aiLogger.warn("No ingredients provided for allergy detection");

    return aiError("No ingredients provided", "INVALID_INPUT");
  }

  aiLogger.info(
    {
      title: recipe.title,
      ingredientCount: recipe.ingredients.length,
      allergenCount: allergiesToDetect.length,
    },
    "Starting allergy detection"
  );

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();

    const prompt = buildAllergyDetectionPrompt(recipe, allergiesToDetect);

    aiLogger.debug({ provider: providerName, prompt }, "Sending allergy detection prompt to AI");

    const result = await generateText({
      model,
      output: Output.object({ schema: allergyDetectionSchema }),
      prompt,
      system:
        "You are an allergy detection assistant. Analyze recipe ingredients to identify allergens. Be accurate and only report allergens that are definitely present.",
      ...settings,
    });

    const output = result.output;

    if (!output) {
      aiLogger.error({ title: recipe.title }, "AI returned empty output for allergy detection");

      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    // Validate the response
    if (!Array.isArray(output.detectedAllergens)) {
      aiLogger.error({ title: recipe.title, output }, "Invalid allergy detection response");

      return aiError("AI response missing detectedAllergens array", "VALIDATION_ERROR");
    }

    // Filter to only include allergens from the original list (case-insensitive)
    const allergenLower = new Set(allergiesToDetect.map((a) => a.toLowerCase()));
    const validAllergens = output.detectedAllergens.filter((a) =>
      allergenLower.has(a.toLowerCase())
    );

    // Normalize: lowercase, trim, deduplicate
    const normalizedAllergens = Array.from(
      new Set(validAllergens.map((a) => a.toLowerCase().trim()).filter((a) => a.length > 0))
    );

    aiLogger.info(
      { title: recipe.title, detected: normalizedAllergens },
      "Allergy detection completed"
    );

    return aiSuccess(normalizedAllergens, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, title: recipe.title, code }, "Failed to detect allergies");

    return aiError(message, code);
  }
}
