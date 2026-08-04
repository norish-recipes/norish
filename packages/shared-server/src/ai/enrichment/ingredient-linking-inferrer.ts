/**
 * Ingredient Linking inference.
 *
 * One AI request reads the recipe's ingredient lines and steps — one
 * measurement system's rows, since the linking is semantic — and proposes,
 * per step, which lines the step uses and what fraction of each. The prompt
 * numbers lines and steps; the claim comes back in those numbers and is
 * mapped onto row orders here, so nothing downstream ever sees a prompt
 * numbering. Heading rows are never offered and never accepted.
 *
 * Inference reads only the stored recipe. Which steps may be written — the
 * gap-filling — is not decided here: the worker and the repository write
 * skip steps that already have Step Ingredients.
 */

import { aiLogger } from "@norish/shared-server/logger";

import { generateStructured } from "../runtime/runtime";
import { ingredientLinkingSchema } from "./ingredient-linking.schema";

export interface IngredientLineForLinking {
  /** The line's order within its measurement system — the reference key. */
  order: number;
  text: string;
  /** The line's numeric amount, for turning a stated amount into a share. */
  amount: number | null;
  isHeading: boolean;
}

export interface StepForLinking {
  /** The step's order within its measurement system. */
  order: number;
  text: string;
  isHeading: boolean;
}

export interface RecipeForIngredientLinking {
  title: string;
  ingredients: IngredientLineForLinking[];
  steps: StepForLinking[];
}

/** One step's inferred references, in row-order space. */
export interface InferredStepLinks {
  stepOrder: number;
  refs: { ingredientOrder: number; share: number; order: number }[];
}

export interface IngredientLinkingInference {
  links: InferredStepLinks[];
}

/**
 * The claim states how much as a share or as an amount; the stored form is a
 * share. A stated amount is divided by the line's own amount — the model
 * reads numbers, this code does arithmetic — and clamped to the whole line:
 * a step cannot use more than the line holds. A line with no amount has
 * nothing to divide by, so the claim falls back to the stated share, or to
 * the whole line.
 */
function toShare(
  candidate: { share: number | null; amount: number | null },
  lineAmount: number | null
): number {
  if (candidate.amount != null && lineAmount != null && lineAmount > 0) {
    return Math.min(1, candidate.amount / lineAmount);
  }

  return candidate.share ?? 1;
}

export async function inferStepIngredients(
  recipe: RecipeForIngredientLinking
): Promise<IngredientLinkingInference> {
  // Heading rows are structure, not ingredients or steps: they are neither
  // offered to the model nor accepted back.
  const linkableLines = recipe.ingredients.filter((line) => !line.isHeading);
  const linkableSteps = recipe.steps.filter((step) => !step.isHeading);

  if (linkableLines.length === 0 || linkableSteps.length === 0) {
    throw new Error("No linkable ingredients or steps");
  }

  aiLogger.info(
    {
      title: recipe.title,
      ingredientCount: linkableLines.length,
      stepCount: linkableSteps.length,
    },
    "Starting Ingredient Linking inference"
  );

  const output = await generateStructured({
    prompt: "ingredient-linking",
    schema: ingredientLinkingSchema,
    fill: {
      recipeName: recipe.title,
      ingredients: linkableLines.map((line, index) => `${index + 1}. ${line.text}`).join("\n"),
      steps: linkableSteps.map((step, index) => `${index + 1}. ${step.text}`).join("\n"),
    },
  });

  // Map prompt numbering back onto row orders, dropping anything the model
  // invented. An empty claim is a valid answer, not a failure: a recipe
  // whose steps genuinely use nothing stays bare.
  const links: InferredStepLinks[] = [];

  for (const entry of output.links ?? []) {
    const step = linkableSteps[entry.step - 1];

    if (!step) continue;

    const refs = (entry.ingredients ?? []).flatMap((candidate, index) => {
      const line = linkableLines[candidate.line - 1];

      if (!line) return [];

      return [
        { ingredientOrder: line.order, share: toShare(candidate, line.amount), order: index },
      ];
    });

    if (refs.length > 0) {
      links.push({ stepOrder: step.order, refs });
    }
  }

  aiLogger.info(
    { title: recipe.title, linkedSteps: links.length },
    "Ingredient Linking inference completed"
  );

  return { links };
}
