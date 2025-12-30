import { generateText, Output } from "ai";

import { getModels, getGenerationSettings } from "./providers/registry";
import { nutritionEstimationSchema, type NutritionEstimate } from "./schemas/nutrition.schema";
import { loadPrompt, fillPrompt } from "./prompts/loader";
import { aiSuccess, aiError, mapErrorToCode, getErrorMessage, type AIResult } from "./types/result";

import { isAIEnabled } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

// Re-export type for consumers
export type { NutritionEstimate };

export interface IngredientForEstimation {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
}

/**
 * Build the prompt for nutrition estimation.
 */
async function buildNutritionPrompt(
  recipeName: string,
  servings: number,
  ingredients: IngredientForEstimation[]
): Promise<string> {
  const template = await loadPrompt("nutrition-estimation");

  const ingredientsList = ingredients
    .map((i) => {
      const parts: string[] = [];

      if (i.amount != null) parts.push(i.amount.toString());
      if (i.unit) parts.push(i.unit);

      parts.push(i.ingredientName);

      return `- ${parts.join(" ")}`;
    })
    .join("\n");

  return fillPrompt(template, {
    recipeName,
    servings: servings.toString(),
    ingredients: ingredientsList,
  });
}

export async function estimateNutritionFromIngredients(
  recipeName: string,
  servings: number,
  ingredients: IngredientForEstimation[]
): Promise<AIResult<NutritionEstimate>> {
  // Guard: AI must be enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping nutrition estimation");
    return aiError("AI features are disabled", "AI_DISABLED");
  }

  if (ingredients.length === 0) {
    aiLogger.warn("No ingredients provided for nutrition estimation");
    return aiError("No ingredients provided", "INVALID_INPUT");
  }

  aiLogger.info(
    { recipeName, servings, ingredientCount: ingredients.length },
    "Starting nutrition estimation"
  );

  try {
    const { model, providerName } = await getModels();
    const settings = await getGenerationSettings();
    const prompt = await buildNutritionPrompt(recipeName, servings, ingredients);

    aiLogger.debug({ provider: providerName, prompt }, "Sending nutrition estimation prompt to AI");

    const result = await generateText({
      model,
      output: Output.object({ schema: nutritionEstimationSchema }),
      prompt,
      system:
        "Estimate nutritional values for this recipe based on the ingredients. Return accurate per-serving values.",
      ...settings,
    });

    const output = result.output;

    if (!output) {
      aiLogger.error({ recipeName }, "AI returned empty output for nutrition estimation");
      return aiError("AI returned empty response", "EMPTY_RESPONSE");
    }

    // Validate the response has reasonable values
    if (
      typeof output.calories !== "number" ||
      typeof output.fat !== "number" ||
      typeof output.carbs !== "number" ||
      typeof output.protein !== "number"
    ) {
      aiLogger.error({ recipeName, output }, "Invalid nutrition estimation response");
      return aiError("AI response missing required fields", "VALIDATION_ERROR");
    }

    aiLogger.info(
      {
        recipeName,
        calories: output.calories,
        fat: output.fat,
        carbs: output.carbs,
        protein: output.protein,
      },
      "Nutrition estimation completed"
    );

    return aiSuccess(output, {
      inputTokens: result.usage?.inputTokens ?? 0,
      outputTokens: result.usage?.outputTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    });
  } catch (error) {
    const code = mapErrorToCode(error);
    const message = getErrorMessage(code, error instanceof Error ? error.message : undefined);

    aiLogger.error({ err: error, recipeName, code }, "Failed to estimate nutrition");

    return aiError(message, code);
  }
}
