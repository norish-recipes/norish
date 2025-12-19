import { nutritionEstimationSchema } from "./schemas/nutrition";
import { getAIProvider } from "./providers/factory";
import { loadPrompt, fillPrompt } from "./prompts/loader";

import { isAIEnabled } from "@/config/server-config-loader";
import { aiLogger } from "@/server/logger";

export interface NutritionEstimate {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export interface IngredientForEstimation {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
}

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

/**
 * Estimate nutrition information for a recipe based on its ingredients.
 * Returns null if AI is disabled or estimation fails.
 */
export async function estimateNutritionFromIngredients(
  recipeName: string,
  servings: number,
  ingredients: IngredientForEstimation[]
): Promise<NutritionEstimate | null> {
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    aiLogger.info("AI features are disabled, skipping nutrition estimation");

    return null;
  }

  if (ingredients.length === 0) {
    aiLogger.warn("No ingredients provided for nutrition estimation");

    return null;
  }

  aiLogger.info(
    { recipeName, servings, ingredientCount: ingredients.length },
    "Starting nutrition estimation"
  );

  try {
    const provider = await getAIProvider();
    const prompt = await buildNutritionPrompt(recipeName, servings, ingredients);

    aiLogger.debug({ prompt }, "Sending nutrition estimation prompt to AI");

    const result = await provider.generateStructuredOutput<NutritionEstimate>(
      prompt,
      nutritionEstimationSchema,
      "Estimate nutritional values for this recipe. Return valid JSON only."
    );

    if (!result) {
      aiLogger.error({ recipeName }, "AI returned null for nutrition estimation");

      return null;
    }

    // Validate the response has reasonable values
    if (
      typeof result.calories !== "number" ||
      typeof result.fat !== "number" ||
      typeof result.carbs !== "number" ||
      typeof result.protein !== "number"
    ) {
      aiLogger.error({ recipeName, result }, "Invalid nutrition estimation response");

      return null;
    }

    aiLogger.info(
      {
        recipeName,
        calories: result.calories,
        fat: result.fat,
        carbs: result.carbs,
        protein: result.protein,
      },
      "Nutrition estimation completed"
    );

    return result;
  } catch (error) {
    aiLogger.error({ err: error, recipeName }, "Failed to estimate nutrition");

    return null;
  }
}
