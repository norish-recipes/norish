/**
 * Ingredient Linking Worker
 *
 * One AI request infers, per step, which ingredient lines the step uses and
 * what fraction of each. The inference is semantic and runs once, against the
 * recipe's active measurement system; the repository write fans it out to
 * every system's rows by order. Ordinarily it is a gap-filler: only steps with
 * no Step Ingredients receive links, so a person's own links are never
 * replaced. An administrator's bulk refresh is the exception, and it clears
 * the recipe's links before writing. An empty claim is an unchanged success,
 * not a failure, and never clears anything.
 *
 * The worker holds no database handle and composes no queries: it calls one
 * repository operation, which is where the gap-filling write lives.
 */

import type { Job } from "bullmq";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import type { RecipeForIngredientLinking } from "@norish/shared-server/ai/enrichment/ingredient-linking-inferrer";
import { writeInferredStepIngredients } from "@norish/db/repositories/recipe-enrichment";
import { inferStepIngredients } from "@norish/shared-server/ai/enrichment/ingredient-linking-inferrer";
import { createLogger } from "@norish/shared-server/logger";
import { enrichmentWriteMode } from "@norish/shared/lib/recipe-enrichment";
import { toLineAmount } from "@norish/shared/lib/step-ingredients";

import { createWorker } from "../create-worker";
import { handleEnrichmentJobFailure, runEnrichmentJob } from "../enrichment/worker-runner";
import { reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

const log = createLogger("worker:ingredient-linking");

type RecipeForLinking = Parameters<Parameters<typeof runEnrichmentJob>[1]>[0];

/**
 * The semantic view the inference reads: the active system's rows, with
 * their orders as reference keys. Heading rows are marked so the inferrer
 * neither offers nor accepts them. Line amounts ride along numerically so a
 * claim that states an amount can be turned into a share of its line.
 */
export function toLinkableRecipe(recipe: RecipeForLinking): RecipeForIngredientLinking {
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

/** Exported so the job body can be exercised without a Valkey-backed worker. */
export async function processIngredientLinkingJob(
  job: Job<RecipeEnrichmentJobData>
): Promise<void> {
  await runEnrichmentJob(job, async (recipe) => {
    const claim = await inferStepIngredients(toLinkableRecipe(recipe));

    if (claim.links.length === 0) {
      // A recipe whose steps genuinely use nothing stays bare, and later
      // runs may examine it again. Nothing changed, and nothing failed.
      log.info({ recipeId: recipe.id, origin: job.data.origin }, "No Step Ingredients claimed");

      return false;
    }

    await reportStep(job, "saving");

    const mode = enrichmentWriteMode("ingredient-linking", job.data);
    const written = await writeInferredStepIngredients(
      recipe.id,
      claim.links.map((link) => ({ stepOrder: link.stepOrder, refs: link.refs })),
      mode
    );

    // Clearing counts as a change on its own: a refresh whose claim landed on
    // no step still emptied the ones it removed, and clients would otherwise
    // keep rendering links the recipe no longer has.
    const changed = written.filled > 0 || written.cleared > 0;

    log.info(
      {
        recipeId: recipe.id,
        claimedSteps: claim.links.length,
        writtenSteps: written.filled,
        clearedSteps: written.cleared,
        origin: job.data.origin,
        mode,
      },
      changed
        ? "Step Ingredients saved"
        : "Step Ingredients deferred: every claimed step already has links"
    );

    return changed;
  });
}

export function startIngredientLinkingWorker(): void {
  createWorker<RecipeEnrichmentJobData>(
    QUEUE_NAMES.INGREDIENT_LINKING,
    processIngredientLinkingJob,
    { onFailed: handleEnrichmentJobFailure }
  );
}
