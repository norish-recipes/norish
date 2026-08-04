import { aiLogger } from "@norish/shared-server/logger";

import type { NutritionEstimate } from "./nutrition.schema";
import { generateStructured } from "../runtime/runtime";
import { nutritionEstimationSchema } from "./nutrition.schema";

// Re-export type for consumers
export type { NutritionEstimate };

export interface IngredientForEstimation {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
}

export async function estimateNutritionFromIngredients(
  recipeName: string,
  servings: number,
  ingredients: IngredientForEstimation[]
): Promise<NutritionEstimate> {
  if (ingredients.length === 0) {
    throw new Error("No ingredients provided for nutrition estimation");
  }

  aiLogger.info(
    { recipeName, servings, ingredientCount: ingredients.length },
    "Starting nutrition estimation"
  );

  const ingredientsList = ingredients
    .map((i) => {
      const parts: string[] = [];

      if (i.amount != null) parts.push(i.amount.toString());
      if (i.unit) parts.push(i.unit);

      parts.push(i.ingredientName);

      return `- ${parts.join(" ")}`;
    })
    .join("\n");

  const output = await generateStructured({
    prompt: "nutrition-estimation",
    schema: nutritionEstimationSchema,
    fill: {
      recipeName,
      servings: servings.toString(),
      ingredients: ingredientsList,
    },
  });

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

  return output;
}
