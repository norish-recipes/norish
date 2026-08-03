/**
 * Ingredient Linking Worker
 *
 * One AI request infers, per step, which ingredient lines the step uses and
 * what fraction of each. The inference is semantic and runs once, against the
 * recipe's active measurement system; the repository write fans it out to
 * every system's rows by order. It is a gap-filler in every case: only steps
 * with no Step Ingredients receive links, so a person's own links are never
 * replaced, whatever the run's origin. An empty claim is an unchanged
 * success, not a failure. Uses lazy worker pattern.
 *
 * The worker holds no database handle and composes no queries: it calls one
 * repository operation, which is where the gap-filling write lives.
 */

import type { Job } from "bullmq";

import type { QueueRecipeForIngredientLinking } from "@norish/queue/api-handlers";
import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { addStepIngredientsToBareSteps } from "@norish/db/repositories/recipe-enrichment";
import { requireQueueApiHandler } from "@norish/queue/api-handlers";
import { toLineAmount } from "@norish/shared/lib/step-ingredients";
import { createLogger } from "@norish/shared-server/logger";

import { defineLazyWorker, QUEUE_NAMES } from "../config";
import { handleEnrichmentJobFailure, runEnrichmentJob } from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";

const log = createLogger("worker:ingredient-linking");

type RecipeForLinking = Parameters<Parameters<typeof runEnrichmentJob>[1]>[0];

/**
 * The semantic view the inference reads: the active system's rows, with
 * their orders as reference keys. Heading rows are marked so the inferrer
 * neither offers nor accepts them. Line amounts ride along numerically so a
 * claim that states an amount can be turned into a share of its line.
 */
export function toLinkableRecipe(recipe: RecipeForLinking): QueueRecipeForIngredientLinking {
  const system = recipe.systemUsed;

  return {
    title: recipe.name,
    ingredients: recipe.recipeIngredients
      .filter((line) => line.systemUsed === system)
      .sort((a, b) => a.order - b.order)
      .map((line) => ({
        order: line.order,
        text: [line.amount, line.unit, line.ingredientName]
          .filter((part) => part !== null && part !== undefined && part !== "")
          .join(" "),
        amount: toLineAmount(line.amount),
        isHeading: line.ingredientName.trim().startsWith("#"),
      })),
    steps: recipe.steps
      .filter((step) => step.systemUsed === system)
      .sort((a, b) => a.order - b.order)
      .map((step) => ({
        order: step.order,
        text: step.step,
        isHeading: step.step.trim().startsWith("#"),
      })),
  };
}

/** Exported so the job body can be exercised without a Redis-backed worker. */
export async function processIngredientLinkingJob(
  job: Job<RecipeEnrichmentJobData>
): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    const inferStepIngredients = requireQueueApiHandler("inferStepIngredients");
    const result = await inferStepIngredients(toLinkableRecipe(recipe));

    if (!result.success) {
      throw new Error(result.error);
    }

    const claim = result.data;

    if (claim.links.length === 0) {
      // A recipe whose steps genuinely use nothing stays bare, and later
      // runs may examine it again. Nothing changed, and nothing failed.
      log.info({ recipeId: recipe.id, origin: job.data.origin }, "No Step Ingredients claimed");

      return false;
    }

    await reportStep(job, "saving");

    const written = await addStepIngredientsToBareSteps(
      recipe.id,
      claim.links.map((link) => ({ stepOrder: link.stepOrder, refs: link.refs }))
    );

    log.info(
      {
        recipeId: recipe.id,
        claimedSteps: claim.links.length,
        writtenSteps: written,
        origin: job.data.origin,
      },
      written > 0
        ? "Step Ingredients saved to bare steps"
        : "Step Ingredients deferred: every claimed step already has links"
    );

    return written > 0;
  });
}

const ingredientLinkingWorker = defineLazyWorker<RecipeEnrichmentJobData>(
  QUEUE_NAMES.INGREDIENT_LINKING,
  processIngredientLinkingJob,
  handleEnrichmentJobFailure
);

export const startIngredientLinkingWorker = ingredientLinkingWorker.start;
export const stopIngredientLinkingWorker = ingredientLinkingWorker.stop;
