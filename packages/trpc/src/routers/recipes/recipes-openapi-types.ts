import { z } from "zod";

import { NUTRITION_CREDITS } from "@norish/shared/contracts/ingredient-nutrition";
import { EXTRA_NUTRIENTS } from "@norish/shared/contracts/nutrients";
import { MAX_RECIPE_PASTE_CHARS } from "@norish/shared/contracts/uploads";

export const recipeAutocompleteInputSchema = z.object({
  query: z.string().min(1).max(100),
});

export const randomRecipeInputSchema = z.object({
  category: z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]).optional(),
});

export const recipeImportPasteInputSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe(
      [
        "Pasted recipe text.",
        "Supports plain text, JSON-LD recipe objects/arrays/@graph payloads, and YAML recipe mappings/arrays.",
        `Each recipe is limited to ${MAX_RECIPE_PASTE_CHARS.toLocaleString()} characters.`,
        "When forcing AI only one recipe will be parsed.",
        'JSON-LD single example: {"@type":"Recipe","name":"Toast","recipeIngredient":["2 slices bread"],"recipeInstructions":["Toast bread"]}',
        'JSON-LD multi example: [{"@type":"Recipe",...},{"@type":"Recipe",...}]',
        "YAML single example: title: Toast\\ningredients:\\n  - 2 slices bread\\nsteps:\\n  - Toast bread",
        "YAML multi example: - title: Toast\\n  ingredients:\\n    - 2 slices bread\\n  steps:\\n    - Toast bread",
      ].join(" ")
    ),
  forceAI: z.boolean().optional(),
});

export const recipeImportPasteOutputSchema = z.object({
  recipeIds: z
    .array(z.uuid())
    .describe(
      "Created recipe IDs in source order. Single imports still return one ID in this array."
    ),
});

export const recipeIdInputSchema = z.object({ recipeId: z.uuid() });

const nutritionValue = (what: string) =>
  z.number().nullable().describe(`${what} per serving; null where the recipe does not say`);

export const recipeNutritionOutputSchema = z.object({
  source: z
    .enum(["supplied", "worked-out", "none"])
    .describe(
      "supplied: the recipe's own Nutrition Information. worked-out: summed from its ingredient lines' dataset numbers for your household, plus the AI's stored share of lines that could not be counted. none: neither gives a number."
    ),
  perServing: z
    .object({
      calories: nutritionValue("Calories in kcal"),
      fat: nutritionValue("Fat in grams"),
      carbs: nutritionValue("Carbohydrates in grams"),
      protein: nutritionValue("Protein in grams"),
      extras: z
        .partialRecord(z.enum(EXTRA_NUTRIENTS), z.number())
        .describe(
          "Other nutrients per serving, only those known: cholesterol, sodium, potassium, calcium, iron and vitaminC in milligrams, vitaminA in micrograms RAE, the rest in grams. The recipe's own value wins; the others are worked out from its lines."
        ),
    })
    .nullable(),
  estimated: z
    .boolean()
    .describe(
      "Whether a worked-out total leans on parent foods for a tenth of its calories or more, or on the AI for a line."
    ),
  leftOut: z
    .array(
      z.object({
        name: z.string(),
        reason: z.enum([
          "seasoning",
          "no-amount",
          "no-size",
          "no-numbers",
          "no-spoon-weight",
          "no-piece-weight",
        ]),
        estimatedByAI: z.boolean().describe("Whether the AI's share of this line is in the total."),
      })
    )
    .describe("Lines a worked-out total did not count from the datasets, in recipe order."),
  credits: z
    .array(z.enum(NUTRITION_CREDITS))
    .describe("Datasets a worked-out total took a number from."),
  extrasCoverage: z
    .partialRecord(z.enum(EXTRA_NUTRIENTS), z.number().min(0).max(1))
    .describe(
      "For each extra nutrient, the share (0 to 1) of the counted ingredients by weight whose food knew it; 1 where the recipe states it. Below 1 the value is low by whatever the other ingredients hold."
    ),
});
