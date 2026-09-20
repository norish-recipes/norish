/**
 * Allergy detection: which of the household's allergens a recipe contains.
 *
 * Two paths, in a fixed order (ADR-0035): a Decision when a Decision Model is
 * configured and this use is on, and otherwise — or when any allergen falls in
 * the doubtful band, or the Decision fails — the language-model request the
 * kind has always made. Only allergens from the household's own list are ever
 * reported, on either path.
 *
 * This is the one enrichment kind whose output matters for someone's health,
 * so the Decision rule is deliberately two-sided: an allergen the model is
 * clearly sure is present is tagged, one it is clearly sure is absent is not,
 * and a recipe with any allergen in between is handed whole to the language
 * model. There is no per-allergen merge, on purpose: a partial merge is where
 * a missed allergen would come from.
 */

import { z } from "zod";

import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";
import { aiLogger } from "@norish/shared-server/logger";

import type { DecisionBooleanQuestion } from "../runtime/runtime";
import { decide, generateStructured } from "../runtime/runtime";
import {
  ALLERGEN_DROP_THRESHOLD,
  MAX_QUESTIONS_PER_DECISION,
  chunk,
  verifyClaims,
} from "./verification";

/**
 * At or above this probability of presence the allergen is tagged. Below
 * {@link ABSENT_THRESHOLD} it is not. Anything between the two, for any one
 * allergen, sends the whole recipe to the language model. The band is
 * asymmetric on purpose: the cost of a missed allergen is not the cost of a
 * spurious tag. Both are starting points, to be tuned against measurements.
 */
export const PRESENT_THRESHOLD = 0.7;

/** At or below this probability of presence the allergen is absent; not tagged. */
export const ABSENT_THRESHOLD = 0.15;

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

/** The structured recipe the Decision Model is asked about. */
function recipeState(recipe: RecipeForAllergyDetection) {
  return {
    title: recipe.title,
    description: recipe.description ?? "",
    ingredients: recipe.ingredients,
  };
}

/** The rule the allergy-detection Prompt states, asked of one allergen. */
function allergenQuestion(allergen: string): DecisionBooleanQuestion {
  return {
    type: "boolean",
    instructions: `Does this recipe contain ${allergen}, in any ingredient, including as a component of a prepared ingredient?`,
  };
}

/**
 * Ask the Decision Model one Boolean per household allergen, keyed by the
 * allergen name as stored, in as many requests as the question limit needs.
 * Returns the allergens at or above the present threshold and the ones in
 * the doubtful band — any of which makes the whole run the unclear case,
 * which is not an answer. Throws whatever `decide` throws.
 */
async function decideAllergens(
  recipe: RecipeForAllergyDetection,
  allergiesToDetect: string[]
): Promise<{ present: string[]; doubtful: string[] }> {
  const present: string[] = [];
  const doubtful: string[] = [];

  for (const batch of chunk(allergiesToDetect, MAX_QUESTIONS_PER_DECISION)) {
    const questions: Record<string, DecisionBooleanQuestion> = Object.fromEntries(
      batch.map((allergen) => [allergen, allergenQuestion(allergen)])
    );

    const { answers } = await decide({
      feature: "allergy-detection",
      state: recipeState(recipe),
      questions,
    });

    for (const allergen of batch) {
      const { probability } = answers[allergen];

      if (probability >= PRESENT_THRESHOLD) present.push(allergen);
      else if (probability > ABSENT_THRESHOLD) doubtful.push(allergen);
    }
  }

  return { present, doubtful };
}

/** Lowercase, trim, drop blanks, deduplicate. */
function normalizeAllergens(allergens: readonly string[]): string[] {
  return Array.from(
    new Set(allergens.map((a) => a.toLowerCase().trim()).filter((a) => a.length > 0))
  );
}

/**
 * The request this kind has always made: the household's list as a Prompt
 * Section, a free-text array back, filtered down to the list. Its own claims
 * are then validated (Enrichment Validation) under the strict allergen
 * constant before they are returned.
 */
async function detectWithLanguageModel(
  recipe: RecipeForAllergyDetection,
  allergiesToDetect: string[]
): Promise<string[]> {
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
  const claimed = normalizeAllergens(validAllergens);

  if (claimed.length === 0) return claimed;

  // A spurious allergen tag is a nuisance and a missing one can hurt someone,
  // so only a tag the Decision Model is all but certain is wrong is dropped.
  const { kept } = await verifyClaims({
    feature: "allergy-detection",
    state: recipeState(recipe),
    claims: claimed.map((allergen) => ({
      id: allergen,
      question: allergenQuestion(allergen).instructions,
    })),
    dropThreshold: ALLERGEN_DROP_THRESHOLD,
  });

  return kept.map((claim) => claim.id);
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

  if (await isDecisionUseEnabled("allergyDetection")) {
    // A Decision failure of any retryability is a warn log and the fallback,
    // never the reason the job fails.
    const decided = await decideAllergens(recipe, allergiesToDetect).catch((error: unknown) => {
      aiLogger.warn(
        { err: error, feature: "allergy-detection" },
        "Decision failed, falling back to the language model"
      );

      return null;
    });

    if (decided && decided.doubtful.length === 0) {
      const detected = normalizeAllergens(decided.present);

      aiLogger.info(
        { title: recipe.title, detected, path: "decision", tagged: detected.length, doubtful: 0 },
        "Allergy detection completed"
      );

      return detected;
    }

    if (decided) {
      // One doubtful allergen sends the whole recipe on: the Decision's
      // answers are not merged with the language model's.
      aiLogger.info(
        {
          title: recipe.title,
          feature: "allergy-detection",
          tagged: decided.present.length,
          doubtful: decided.doubtful.length,
        },
        "Decision was unsure about an allergen, asking the language model"
      );
    }
  }

  const detected = await detectWithLanguageModel(recipe, allergiesToDetect);

  aiLogger.info(
    { title: recipe.title, detected, path: "language-model" },
    "Allergy detection completed"
  );

  return detected;
}
