import { z } from "zod";

import { missingExtrasAsNull } from "@norish/shared/contracts/nutrients";

/**
 * Schema for AI-based nutrition estimation.
 *
 * Returns per-serving nutritional values. The four are required and
 * non-negative: an estimate is complete or it is rejected, because replacement
 * writes the whole group and a gap would be stored as null. Zero is a valid
 * estimate for a nutrient a recipe genuinely lacks. The other nutrients a
 * language model can estimate (`ESTIMATED_EXTRA_NUTRIENTS`) are asked for too,
 * but one it leaves out is unknown, not a reason to refuse the four.
 */
export const nutritionEstimationSchema = missingExtrasAsNull(
  z
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
        .describe(
          "Estimated carbohydrates per serving in grams; 0 when none. Required, never null."
        ),
      protein: z
        .number()
        .min(0)
        .describe("Estimated protein per serving in grams; 0 when none. Required, never null."),
      saturatedFat: z
        .number()
        .min(0)
        .nullable()
        .describe("Saturated fat per serving in grams, part of the fat; 0 when none."),
      sugars: z
        .number()
        .min(0)
        .nullable()
        .describe("Sugars per serving in grams, part of the carbohydrates; 0 when none."),
      fiber: z
        .number()
        .min(0)
        .nullable()
        .describe("Fiber per serving in grams, not part of the carbohydrates; 0 when none."),
      sodium: z
        .number()
        .min(0)
        .nullable()
        .describe("Sodium per serving in milligrams; 0 when none."),
    })
    .strict()
);

export type NutritionEstimate = z.infer<typeof nutritionEstimationSchema>;

/**
 * Schema for the estimate of the lines a worked-out total left out
 * (ADR-0039): one entry per numbered ingredient line, each line's own
 * per-serving share. Every line is required once; the estimator refuses an
 * answer that skips or doubles one, so a stored share always has a line.
 */
export const nutritionGapEstimationSchema = z
  .object({
    lines: z
      .array(
        missingExtrasAsNull(
          z
            .object({
              line: z
                .number()
                .int()
                .min(1)
                .describe("The ingredient's number in the list, starting at 1."),
              calories: z
                .number()
                .min(0)
                .describe(
                  "This ingredient's calories per serving in kcal, on its own. Should equal approximately: fat * 9 + carbs * 4 + protein * 4."
                ),
              fat: z
                .number()
                .min(0)
                .describe("This ingredient's fat per serving in grams; 0 when none."),
              carbs: z
                .number()
                .min(0)
                .describe("This ingredient's carbohydrates per serving in grams; 0 when none."),
              protein: z
                .number()
                .min(0)
                .describe("This ingredient's protein per serving in grams; 0 when none."),
              saturatedFat: z
                .number()
                .min(0)
                .nullable()
                .describe(
                  "Saturated fat per serving of this ingredient in grams, part of the fat; 0 when none."
                ),
              sugars: z
                .number()
                .min(0)
                .nullable()
                .describe(
                  "Sugars per serving of this ingredient in grams, part of the carbohydrates; 0 when none."
                ),
              fiber: z
                .number()
                .min(0)
                .nullable()
                .describe(
                  "Fiber per serving of this ingredient in grams, not part of the carbohydrates; 0 when none."
                ),
              sodium: z
                .number()
                .min(0)
                .nullable()
                .describe("Sodium per serving of this ingredient in milligrams; 0 when none."),
            })
            .strict()
        )
      )
      .describe("One entry per numbered ingredient, in order; none left out."),
  })
  .strict();

export type NutritionGapEstimate = z.infer<typeof nutritionGapEstimationSchema>;
