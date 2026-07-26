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

/**
 * Nutrition Information read from the source rather than estimated.
 *
 * Every field is nullable because extraction reports what the source states and
 * nothing more; estimating the missing ones is the nutrition-estimation
 * enrichment worker's job, under the administrator's automatic setting.
 */
export const sourceNutritionSchema = z
  .object({
    calories: z
      .number()
      .nullable()
      .describe("Calories per serving stated by the source, else null"),
    fat: z.number().nullable().describe("Fat per serving in grams stated by the source, else null"),
    carbs: z
      .number()
      .nullable()
      .describe("Carbohydrates per serving in grams stated by the source, else null"),
    protein: z
      .number()
      .nullable()
      .describe("Protein per serving in grams stated by the source, else null"),
  })
  .strict();

export type SourceNutrition = z.infer<typeof sourceNutritionSchema>;
