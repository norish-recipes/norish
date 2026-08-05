import { z } from "zod";

/**
 * Schema for AI-based nutrition estimation.
 *
 * Returns per-serving nutritional values. All four values are required and
 * non-negative: an estimate is complete or it is rejected, because replacement
 * writes the whole group and a gap would be stored as null. Zero is a valid
 * estimate for a nutrient a recipe genuinely lacks.
 */
export const nutritionEstimationSchema = z
  .object({
    calories: z
      .number()
      .min(0)
      .describe(
        "Estimated calories per serving in kcal. Should equal approximately: fat * 9 + carbs * 4 + protein * 4. Required, never null."
      ),
    fat: z
      .number()
      .min(0)
      .describe("Estimated fat per serving in grams; 0 when none. Required, never null."),
    carbs: z
      .number()
      .min(0)
      .describe("Estimated carbohydrates per serving in grams; 0 when none. Required, never null."),
    protein: z
      .number()
      .min(0)
      .describe("Estimated protein per serving in grams; 0 when none. Required, never null."),
  })
  .strict();

export type NutritionEstimate = z.infer<typeof nutritionEstimationSchema>;
