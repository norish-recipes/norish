/**
 * Announce a Usable Recipe.
 *
 * Every creation path calls this once a genuinely new recipe has committed and
 * can be loaded. It is the only handoff from creation to enrichment: creation
 * modules extract and persist, and stop there.
 */

import type { CreateRecipeResult } from "@norish/db/repositories/recipes";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { RecipeBecameUsablePayload } from "@norish/shared/contracts/realtime/recipe-enrichment";
import type { RecipeEnrichmentLifecycleState } from "@norish/shared/lib/recipe-enrichment";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { recipeEnrichment } from "@norish/shared-server/realtime/recipe-enrichment";
import { recipes } from "@norish/shared-server/realtime/recipes";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";
import { enrichmentRunId, enrichmentRunSequence } from "./identity";

const log = createLogger("queue:enrichment-announce");

/**
 * Announce a creation result, if it was a genuinely new recipe.
 *
 * Taking the whole result rather than an id is deliberate: an import that
 * resolved to an existing recipe must not be announced, and a creation path
 * that only had the id could silently forget to check.
 *
 * Creation and import success are already terminal by the time this runs, so
 * a failed publish must not surface as a creation failure: the domain logs and
 * drops a Redis failure, and a payload failing its schema only throws outside
 * production. Losing the event costs that recipe's automatic enrichment, which
 * the manual actions recover.
 */
export async function announceUsableRecipe(
  created: CreateRecipeResult | null,
  context: Omit<RecipeBecameUsablePayload, "recipeId">
): Promise<void> {
  if (created?.status !== "inserted") return;

  const payload: RecipeBecameUsablePayload = { recipeId: created.recipeId, ...context };

  await recipeEnrichment.publish("recipeBecameUsable", payload, undefined);
  log.debug({ recipeId: payload.recipeId }, "Announced usable recipe");
}

/** Publish one canonical lifecycle transition through the recipe visibility policy. */
export async function publishEnrichmentLifecycle(
  data: RecipeEnrichmentJobData,
  state: Exclude<RecipeEnrichmentLifecycleState, "idle">
): Promise<void> {
  await recipes.publish(
    "enrichment",
    {
      recipeId: data.recipeId,
      runId: enrichmentRunId(data),
      runSequence: enrichmentRunSequence(data),
      kind: data.kind,
      state,
      origin: data.origin,
      ...(data.origin === "manual" && state === "failed"
        ? { requestedByUserId: data.requestedByUserId ?? data.userId }
        : {}),
    },
    { viewPolicy: await viewPolicy(), ...emitContext(data) }
  );
}

/** Publish the canonical recipe value after an enrichment write. */
export async function publishEnrichmentRecipeUpdated(
  data: RecipeEnrichmentJobData,
  recipe: FullRecipeDTO
): Promise<void> {
  await recipes.publish(
    "updated",
    {
      recipe,
      source: "enrichment",
    },
    { viewPolicy: await viewPolicy(), ...emitContext(data) }
  );
}

async function viewPolicy() {
  return (await getRecipePermissionPolicy()).view;
}

function emitContext(data: RecipeEnrichmentJobData): { userId: string; householdKey: string } {
  return { userId: data.userId, householdKey: data.householdKey };
}
