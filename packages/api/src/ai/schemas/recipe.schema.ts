import { z } from "zod";

import { sourceNutritionSchema } from "./nutrition.schema";

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
    categories: z
      .array(z.string())
      .describe(
        "Meal categories the source explicitly states, from: Breakfast, Lunch, Dinner, Snack. Empty when the source states none."
      ),
    nutrition: sourceNutritionSchema,
  })
  .strict();

export type RecipeExtractionOutput = z.infer<typeof recipeExtractionSchema>;
