/**
 * Which of the owner's household Categories a recipe is (ADR-0040): a Decision
 * first, else the language model (ADR-0035); both pick only from the list.
 */

import { z } from "zod";

import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import { householdCategoriesSection } from "../prompts/sections";
import { decide, generateStructured } from "../runtime/runtime";
import { chunk, MAX_QUESTIONS_PER_DECISION, verifyClaims } from "./verification";

/**
 * A category the Decision Model is at least this sure of is set. Below it the
 * recipe is the unclear case and goes to the language model as it always has.
 */
export const CATEGORY_THRESHOLD = 0.6;

export interface RecipeSummary {
  title: string;
  description: string | null;
  ingredients: string[];
}

/** The structured recipe every Decision here is asked about. */
function recipeState(recipe: RecipeSummary) {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    ingredients: recipe.ingredients,
  };
}

/** The yes/no question for one Category. */
function categoryQuestion(category: string): string {
  return `Does this recipe belong in the category "${category}"?`;
}

/**
 * One Boolean per Category, since a recipe may be several, asked by position so
 * any name is a safe id. None clearing the threshold is the unclear case.
 */
async function decideCategories(
  recipe: RecipeSummary,
  categories: readonly string[]
): Promise<string[]> {
  const picked: string[] = [];
  const ids = categories.map((category, index) => [`c${index}`, category] as const);

  for (const batch of chunk(ids, MAX_QUESTIONS_PER_DECISION)) {
    const { answers } = await decide({
      feature: "auto-categorization",
      state: recipeState(recipe),
      questions: Object.fromEntries(
        batch.map(([id, category]) => [
          id,
          { type: "boolean" as const, instructions: categoryQuestion(category) },
        ])
      ),
    });

    for (const [id, category] of batch) {
      if ((answers[id]?.probability ?? 0) >= CATEGORY_THRESHOLD) picked.push(category);
    }
  }

  return picked;
}

/**
 * The language model picks from the list; Enrichment Validation then drops any
 * the Decision Model rejects. None left is the worker's retryable failure.
 */
async function categorizeWithLanguageModel(
  recipe: RecipeSummary,
  categories: readonly string[]
): Promise<string[]> {
  const [first, ...rest] = categories;

  if (!first) return [];

  const output = await generateStructured({
    prompt: "auto-categorization",
    schema: z
      .object({
        categories: z
          .array(z.enum([first, ...rest]))
          .describe("Array of meal categories for the recipe."),
      })
      .strict(),
    sections: [
      [
        `Title: ${recipe.title}`,
        `Description: ${recipe.description ?? ""}`,
        "Ingredients:",
        ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
      ].join("\n"),
      householdCategoriesSection(categories),
    ],
  });

  // The schema already holds the model to the list; this keeps any other name out.
  const picked = [...new Set(output.categories)].filter((category) =>
    categories.includes(category)
  );

  const { kept } = await verifyClaims({
    feature: "auto-categorization",
    state: recipeState(recipe),
    claims: picked.map((category) => ({ id: category, question: categoryQuestion(category) })),
  });

  return kept.map((claim) => claim.id);
}

export async function categorizeRecipe(
  recipe: RecipeSummary,
  categories: readonly string[]
): Promise<string[]> {
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
    const decided = await decideCategories(recipe, categories).catch((error: unknown) => {
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

  const picked = await categorizeWithLanguageModel(recipe, categories);

  aiLogger.info(
    { title: recipe.title, categories: picked, path: "language-model" },
    "Auto-categorization completed"
  );

  return picked;
}
