import { z } from "zod";

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

/**
 * Dual-system recipe schema for AI extraction.
 * Extracts both metric and US measurements simultaneously.
 */
export const recipeExtractionSchema = z
  .object({
    // No "@context"/"@type" schema.org keys here: Anthropic rejects tool
    // input_schema property keys that don't match ^[a-zA-Z0-9_.-]{1,64}$
    name: z.string().describe("Recipe name/title"),
    description: z.string().nullable().describe("Brief recipe description"),
    notes: z
      .string()
      .nullable()
      .describe("Additional recipe notes only when recipe content explicitly includes them"),
    recipeYield: z
      .union([z.string(), z.number(), z.null()])
      .describe("Number of servings or yield description"),
    prepTime: z
      .string()
      .nullable()
      .describe("Preparation time in ISO 8601 duration format (e.g., PT30M)"),
    cookTime: z
      .string()
      .nullable()
      .describe("Cooking time in ISO 8601 duration format (e.g., PT1H)"),
    totalTime: z.string().nullable().describe("Total time in ISO 8601 duration format"),
    recipeIngredient: z
      .object({
        metric: z
          .array(z.string())
          .describe("Ingredients with metric measurements (g, ml, kg, L, °C)"),
        us: z
          .array(z.string())
          .describe("Ingredients with US measurements (cups, tbsp, tsp, oz, lb, °F)"),
      })
      .strict(),
    recipeInstructions: z
      .object({
        metric: z.array(z.string()).describe("Cooking steps with metric measurements"),
        us: z.array(z.string()).describe("Cooking steps with US measurements"),
      })
      .strict(),
    keywords: z
      .array(z.string())
      .nullable()
      .describe("Tags the source explicitly lists. Do not infer tags the source does not state."),
    allergyIndications: z
      .array(z.string())
      .describe(
        "Allergy or allergen indications the source explicitly states, such as a Contains statement. Empty when the source states none; never infer from ingredients."
      ),
    categories: z
      .array(z.string())
      .describe(
        "Meal categories the source explicitly states, from: Breakfast, Lunch, Dinner, Snack. Empty when the source states none."
      ),
    nutrition: sourceNutritionSchema,
  })
  .strict();

export type RecipeExtractionOutput = z.infer<typeof recipeExtractionSchema>;
