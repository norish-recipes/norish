/**
 * Announce a Usable Recipe.
 *
 * Every creation path calls this once a genuinely new recipe has committed and
 * can be loaded. It is the only handoff from creation to enrichment: creation
 * modules extract and persist, and stop there.
 */

import type { CreateRecipeResult } from "@norish/db/repositories/recipes";
import type { PolicyEmitContext } from "@norish/shared-server/realtime/policy";
import type { RecipeBecameUsablePayload } from "@norish/shared-server/realtime/recipe-enrichment";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { RecipeEnrichmentLifecycleState } from "@norish/shared/lib/recipe-enrichment";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { createLogger } from "@norish/shared-server/logger";
import { emitByPolicy } from "@norish/shared-server/realtime/policy";
import { publishRecipeBecameUsable } from "@norish/shared-server/realtime/recipe-enrichment";
import { recipeEmitter } from "@norish/shared-server/realtime/recipes";

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
 * Publish failures are swallowed. Creation and import success are already
 * terminal by the time this runs, so a failed publish must not surface as a
 * creation failure. Losing the event costs that recipe's automatic enrichment,
 * which the manual actions recover.
 */
export async function announceUsableRecipe(
  created: CreateRecipeResult | null,
  context: Omit<RecipeBecameUsablePayload, "recipeId">
): Promise<void> {
  if (created?.status !== "inserted") return;

  const payload: RecipeBecameUsablePayload = { recipeId: created.recipeId, ...context };

  try {
    await publishRecipeBecameUsable(payload);
    log.debug({ recipeId: payload.recipeId }, "Announced usable recipe");
  } catch (err) {
    log.error({ err, recipeId: payload.recipeId }, "Failed to announce usable recipe");
  }
}

/** Publish one canonical lifecycle transition through the recipe visibility policy. */
export async function publishEnrichmentLifecycle(
  data: RecipeEnrichmentJobData,
  state: Exclude<RecipeEnrichmentLifecycleState, "idle">
): Promise<void> {
  emitByPolicy(recipeEmitter, await viewPolicy(), emitContext(data), "enrichment", {
    recipeId: data.recipeId,
    runId: enrichmentRunId(data),
    runSequence: enrichmentRunSequence(data),
    kind: data.kind,
    state,
    origin: data.origin,
    ...(data.origin === "manual" && state === "failed"
      ? { requestedByUserId: data.requestedByUserId ?? data.userId }
      : {}),
  });
}

/** Publish the canonical recipe value after an enrichment write. */
export async function publishEnrichmentRecipeUpdated(
  data: RecipeEnrichmentJobData,
  recipe: FullRecipeDTO
): Promise<void> {
  emitByPolicy(recipeEmitter, await viewPolicy(), emitContext(data), "updated", { recipe });
}

async function viewPolicy() {
  return (await getRecipePermissionPolicy()).view;
}

function emitContext(data: RecipeEnrichmentJobData): PolicyEmitContext {
  return { userId: data.userId, householdKey: data.householdKey };
}
