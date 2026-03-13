import { z } from "zod";

/**
 * Schema for AI-based nutrition estimation.
 * Returns per-serving nutritional values.
 */
export const nutritionEstimationSchema = z
  .object({
    calories: z
      .number()
      .describe(
        "Estimated calories per serving in kcal. Should equal approximately: fat * 9 + carbs * 4 + protein * 4"
      ),
    fat: z.number().describe("Estimated fat per serving in grams"),
    carbs: z.number().describe("Estimated carbohydrates per serving in grams"),
    protein: z.number().describe("Estimated protein per serving in grams"),
  })
  .strict();

export type NutritionEstimate = z.infer<typeof nutritionEstimationSchema>;
