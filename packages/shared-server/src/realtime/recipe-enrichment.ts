/**
 * Internal "recipe became usable" event.
 *
 * Deliberately separate from the permission-scoped client recipe channel: who
 * may *see* a recipe must not decide whether the enrichment coordinator hears
 * about it. This channel is server-internal and global.
 *
 * It is not persisted or replayed. A brief process or Redis interruption is an
 * accepted enrollment loss window — the alternative is a transactional outbox,
 * which this flow explicitly does not introduce. Duplicate delivery is instead
 * made harmless by deterministic per-recipe-and-kind job identity.
 */

import type { TypedRedisEmitter } from "@norish/shared-server/redis/pubsub";
import { createTypedEmitter } from "@norish/shared-server/redis/pubsub";

/**
 * Recipe identity plus the minimal initiating context needed to enroll jobs.
 * It carries no parser output: the coordinator always reloads current stored
 * state, so eligibility cannot drift from what was actually persisted.
 */
export interface RecipeBecameUsablePayload {
  recipeId: string;
  userId: string;
  householdKey: string;
  householdUserIds: string[] | null;
}

export type RecipeEnrichmentInternalEvents = {
  recipeBecameUsable: RecipeBecameUsablePayload;
};

declare global {
  var __recipeEnrichmentEmitter__: TypedRedisEmitter<RecipeEnrichmentInternalEvents> | undefined;
}

export const recipeEnrichmentEmitter: TypedRedisEmitter<RecipeEnrichmentInternalEvents> =
  globalThis.__recipeEnrichmentEmitter__ ||
  (globalThis.__recipeEnrichmentEmitter__ =
    createTypedEmitter<RecipeEnrichmentInternalEvents>("recipe-enrichment"));

export const RECIPE_BECAME_USABLE_CHANNEL =
  recipeEnrichmentEmitter.globalEvent("recipeBecameUsable");

/**
 * Announce that a genuinely new recipe has committed and can be loaded.
 *
 * Publish after commit and before the creation path reports its post-commit
 * work complete. Creation success is already terminal at this point, so a
 * publish failure is logged by the caller and changes nothing about the recipe.
 */
export async function publishRecipeBecameUsable(
  payload: RecipeBecameUsablePayload
): Promise<boolean> {
  return await recipeEnrichmentEmitter.emitGlobal("recipeBecameUsable", payload);
}
