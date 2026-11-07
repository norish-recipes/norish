/**
 * Auto-categorization: which of the recipe owner's household Categories a
 * recipe is (ADR-0040). Two paths, in a fixed order (ADR-0035): a Decision when
 * a Decision Model is configured and this use is on, and otherwise — or when
 * the Decision is unsure, or fails — a language-model request. Either path
 * only ever picks from the list it is given.
 */

import { z } from "zod";

import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import { householdCategoriesSection } from "../prompts/sections";
import { decide, generateStructured } from "../runtime/runtime";
import { verifyClaims } from "./verification";

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

/** The yes/no question for one Category, keyed by its name in every Decision. */
function categoryQuestion(category: string): string {
  return `Does this recipe belong in the category "${category}"?`;
}

/**
 * One Boolean per Category rather than one Choice, because a recipe may be
 * several. Returns every category that clears the threshold — possibly none,
 * which is the unclear case rather than an answer. Throws whatever `decide`
 * throws; the caller decides what a failure means.
 */
async function decideCategories(
  recipe: RecipeSummary,
  categories: readonly string[]
): Promise<string[]> {
  const { answers } = await decide({
    feature: "auto-categorization",
    // Structured, since the recipe is structured.
    state: recipeState(recipe),
    questions: Object.fromEntries(
      categories.map((category) => [
        category,
        { type: "boolean" as const, instructions: categoryQuestion(category) },
      ])
    ),
  });

  return categories.filter(
    (category) => (answers[category]?.probability ?? 0) >= CATEGORY_THRESHOLD
  );
}

/**
 * The language model picks from the list, then the run's own claims are
 * checked before they are written (Enrichment Validation). A category the
 * Decision Model answers "no" to is not written; when none survives, the
 * worker's empty-list rule makes the run a retryable failure.
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
