import { aiLogger } from "@norish/shared-server/logger";

import type { NutritionEstimate } from "./nutrition.schema";
import type { ValidationMode } from "./verification";
import { AIResponseError } from "../runtime/errors";
import { generateStructured } from "../runtime/runtime";
import { nutritionEstimationSchema } from "./nutrition.schema";
import { verifyClaims } from "./verification";

/**
 * Whether an estimate the Decision Model finds out of reason fails the run
 * so the queue asks the language model again. Shadow until the disagreement
 * rate is known; the group is atomic, so a failed run writes nothing rather
 * than half a group. Promotion is this one constant, with the rate.
 */
const NUTRITION_VALIDATION_MODE: ValidationMode = "shadow";

// Re-export type for consumers
export type { NutritionEstimate };

export interface IngredientForEstimation {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
}

/** A line Ingredient Nutrition already counted, with what it brought for the whole line. */
export interface CountedForEstimation {
  text: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

function rounded(value: number): string {
  return String(Math.round(value * 10) / 10);
}

/**
 * The lines Ingredient Nutrition already counted, as given facts appended to
 * the prompt (ADR-0016), so the model estimates only the lines left out and
 * a total made of both counts nothing twice (ADR-0039).
 */
function countedSection(counted: readonly CountedForEstimation[]): string {
  return [
    "Already counted:",
    "The recipe also has these lines. Norish has already counted them from food composition data, and their numbers are for the whole line, not per serving. Do not include them in your estimate: estimate only the ingredients listed above, per serving.",
    ...counted.map(
      (line) =>
        `- ${line.text}: ${rounded(line.calories)} kcal, ${rounded(line.fat)} g fat, ${rounded(line.carbs)} g carbohydrates, ${rounded(line.protein)} g protein`
    ),
  ].join("\n");
}

/**
 * Estimate a recipe's nutrition per serving from its ingredients. Where
 * Ingredient Nutrition counted some lines already, `ingredients` are only
 * the lines it left out and `counted` the rest: the estimate is then the
 * left-out lines' share alone.
 */
export async function estimateNutritionFromIngredients(
  recipeName: string,
  servings: number,
  ingredients: IngredientForEstimation[],
  counted: readonly CountedForEstimation[] = []
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
    sections: counted.length > 0 ? [countedSection(counted)] : [],
  });
  const what = counted.length > 0 ? "these ingredients of the recipe" : "this recipe";

  // The estimate, checked before it is written (Enrichment Validation): one
  // question per figure, on the same ingredient list the model estimated from.
  const { dropped, mode } = await verifyClaims({
    feature: "nutrition-estimation",
    state: { recipeName, servings, ingredients: ingredientsList.split("\n") },
    claims: [
      {
        id: "calories",
        question: `Is ${output.calories} kcal per serving within reason for ${what}?`,
      },
      {
        id: "fat",
        question: `Is ${output.fat} g of fat per serving within reason for ${what}?`,
      },
      {
        id: "carbs",
        question: `Is ${output.carbs} g of carbohydrates per serving within reason for ${what}?`,
      },
      {
        id: "protein",
        question: `Is ${output.protein} g of protein per serving within reason for ${what}?`,
      },
    ],
    mode: NUTRITION_VALIDATION_MODE,
  });

  if (mode === "enforce" && dropped.length > 0) {
    throw new AIResponseError(
      `The Decision Model finds the estimated ${dropped.map(({ claim }) => claim.id).join(", ")} out of reason; asking again.`
    );
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

  return output;
}
