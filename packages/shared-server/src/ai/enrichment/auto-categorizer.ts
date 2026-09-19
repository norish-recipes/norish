/**
 * Auto-categorization: which of Breakfast, Lunch, Dinner and Snack a recipe
 * is. Two paths, in a fixed order (ADR-0035): a Decision when a Decision Model
 * is configured and this use is on, and otherwise — or when the Decision is
 * unsure, or fails — the language-model request the kind has always made.
 */

import { z } from "zod";

import type { RecipeCategory } from "@norish/shared/contracts";
import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import { decide, generateStructured } from "../runtime/runtime";
import { matchCategory } from "./category-matcher";

/**
 * A category the Decision Model is at least this sure of is set. Below it the
 * recipe is the unclear case and goes to the language model as it always has.
 */
export const CATEGORY_THRESHOLD = 0.6;

const CATEGORIES = ["Breakfast", "Lunch", "Dinner", "Snack"] as const satisfies RecipeCategory[];

const autoCategorizationSchema = z
  .object({
    categories: z.array(z.enum(CATEGORIES)).describe("Array of meal categories for the recipe."),
  })
  .strict();

export interface RecipeSummary {
  title: string;
  description: string | null;
  ingredients: string[];
}

/**
 * Four Booleans rather than one Choice, because a recipe may be several
 * categories and the product already stores several. The criteria labels are
 * the four categories themselves — the domain's own option set, which is why
 * a Decision has no Prompt.
 */
const CATEGORY_QUESTIONS = {
  Breakfast: { type: "boolean", instructions: "Is this recipe a breakfast dish?" },
  Lunch: { type: "boolean", instructions: "Is this recipe a lunch dish?" },
  Dinner: { type: "boolean", instructions: "Is this recipe a dinner dish?" },
  Snack: { type: "boolean", instructions: "Is this recipe a snack?" },
} as const;

/**
 * Ask the Decision Model and return every category that clears the
 * threshold — possibly none, which is the unclear case rather than an answer.
 * Throws whatever `decide` throws; the caller decides what a failure means.
 */
async function decideCategories(recipe: RecipeSummary): Promise<RecipeCategory[]> {
  const { answers } = await decide({
    feature: "auto-categorization",
    // Structured, since the recipe is structured.
    state: {
      title: recipe.title,
      description: recipe.description ?? "",
      ingredients: recipe.ingredients,
    },
    questions: CATEGORY_QUESTIONS,
  });

  return CATEGORIES.filter((category) => answers[category].probability >= CATEGORY_THRESHOLD);
}

/** The request this kind has always made: the words, then the matcher. */
async function categorizeWithLanguageModel(recipe: RecipeSummary): Promise<RecipeCategory[]> {
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
  return Array.from(
    new Set(
      output.categories
        .map((category) => matchCategory(category))
        .filter((category): category is RecipeCategory => Boolean(category))
    )
  );
}

export async function categorizeRecipe(recipe: RecipeSummary): Promise<RecipeCategory[]> {
  if (recipe.ingredients.length === 0) {
    throw new Error("No ingredients provided for auto-categorization");
  }

  aiLogger.info(
    { title: recipe.title, ingredientCount: recipe.ingredients.length },
    "Starting auto-categorization"
  );

  if (await isDecisionUseEnabled("autoCategorization")) {
    // A Decision failure of any retryability is a warn log and the fallback,
    // never the reason the job fails; a Decision that clears nothing is the
    // unclear case and goes to the language model too.
    const decided = await decideCategories(recipe).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "auto-categorization" },
        "Decision failed, falling back to the language model"
      );

      return null;
    });

    if (decided && decided.length > 0) {
      aiLogger.info(
        { title: recipe.title, categories: decided, path: "decision" },
        "Auto-categorization completed"
      );

      return decided;
    }
  }

  const categories = await categorizeWithLanguageModel(recipe);

  aiLogger.info(
    { title: recipe.title, categories, path: "language-model" },
    "Auto-categorization completed"
  );

  return categories;
}
