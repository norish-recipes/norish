import { z } from "zod";

import type { RecipeCategory } from "@norish/shared/contracts";
import { aiLogger } from "@norish/shared-server/logger";

import { generateStructured } from "../runtime/runtime";
import { matchCategory } from "./category-matcher";

const autoCategorizationSchema = z
  .object({
    categories: z
      .array(z.enum(["Breakfast", "Lunch", "Dinner", "Snack"]))
      .describe("Array of meal categories for the recipe."),
  })
  .strict();

export async function categorizeRecipe(recipe: {
  title: string;
  description: string | null;
  ingredients: string[];
}): Promise<RecipeCategory[]> {
  if (recipe.ingredients.length === 0) {
    throw new Error("No ingredients provided for auto-categorization");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length },
    "Starting auto-categorization"
  );

  const output = await generateStructured({
    prompt: "auto-categorization",
    schema: autoCategorizationSchema,
    sections: [
      [
        `Title: ${recipe.title}`,
        `Description: ${recipe.description ?? ""}`,
        "Ingredients:",
        ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
      ].join("\n"),
    ],
  });

  // Model answers are matched onto the four categories; anything else drops.
  const normalizedCategories = Array.from(
    new Set(
      output.categories
        .map((category) => matchCategory(category))
        .filter((category): category is RecipeCategory => Boolean(category))
    )
  );

  aiLogger.info(
    { title: recipe.title, categories: normalizedCategories },
    "Auto-categorization completed"
  );

  return normalizedCategories;
}
