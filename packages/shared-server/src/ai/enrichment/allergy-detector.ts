/**
 * Allergy Detector
 *
 * AI-based detection of allergens in recipe ingredients.
 * Only detects allergens from the provided list (household allergies).
 */

import { z } from "zod";

import { aiLogger } from "@norish/shared-server/logger";

import { generateStructured } from "../runtime/runtime";

/**
 * Schema for allergy detection response.
 */
const allergyDetectionSchema = z
  .object({
    detectedAllergens: z
      .array(z.string())
      .describe(
        "Array of allergen names detected in the recipe. Only include allergens from the provided list that are actually present in the ingredients."
      ),
  })
  .strict();

export type AllergyDetectionOutput = z.infer<typeof allergyDetectionSchema>;

/**
 * Recipe data required for allergy detection.
 */
export interface RecipeForAllergyDetection {
  title: string;
  description?: string | null;
  ingredients: string[];
}

/**
 * Detect allergens in a recipe using AI.
 *
 * @param recipe - The recipe data to analyze
 * @param allergiesToDetect - List of allergen names to look for (from household configuration)
 * @returns Array of detected allergen names; throws on AI failure
 */
export async function detectAllergiesInRecipe(
  recipe: RecipeForAllergyDetection,
  allergiesToDetect: string[]
): Promise<string[]> {
  // Nothing configured to look for is an answer, not a failure.
  if (allergiesToDetect.length === 0) {
    aiLogger.info("No allergens to detect");

    return [];
  }

  if (recipe.ingredients.length === 0) {
    throw new Error("No ingredients provided for allergy detection");
  }

  aiLogger.info(
    {
      title: recipe.title,
      ingredientCount: recipe.ingredients.length,
      allergenCount: allergiesToDetect.length,
    },
    "Starting allergy detection"
  );

  const output = await generateStructured({
    prompt: "allergy-detection",
    schema: allergyDetectionSchema,
    sections: [
      [
        `RECIPE TITLE: ${recipe.title}`,
        ...(recipe.description ? [`DESCRIPTION: ${recipe.description}`] : []),
        "",
        "INGREDIENTS:",
        ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
      ].join("\n"),
      `ALLERGENS TO DETECT: ${allergiesToDetect.join(", ")}`,
    ],
  });

  // Only allergens from the household's own list count, whatever the model
  // volunteered beyond it.
  const allergenLower = new Set(allergiesToDetect.map((a) => a.toLowerCase()));
  const validAllergens = output.detectedAllergens.filter((a) => allergenLower.has(a.toLowerCase()));

  // Normalize: lowercase, trim, deduplicate
  const normalizedAllergens = Array.from(
    new Set(validAllergens.map((a) => a.toLowerCase().trim()).filter((a) => a.length > 0))
  );

  aiLogger.info(
    { title: recipe.title, detected: normalizedAllergens },
    "Allergy detection completed"
  );

  return normalizedAllergens;
}
