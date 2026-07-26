/**
 * Announce a Usable Recipe.
 *
 * Every creation path calls this once a genuinely new recipe has committed and
 * can be loaded. It is the only handoff from creation to enrichment: creation
 * modules extract and persist, and stop there.
 */

import type { RecipeBecameUsablePayload } from "@norish/shared-server/realtime/recipe-enrichment";
import { createLogger } from "@norish/shared-server/logger";
import { publishRecipeBecameUsable } from "@norish/shared-server/realtime/recipe-enrichment";

const log = createLogger("queue:enrichment-announce");

/**
 * Publish the internal creation event, swallowing publish failures.
 *
 * Creation and import success are already terminal by the time this runs, so a
 * failed publish must not surface as a creation failure. Losing the event costs
 * the automatic enrichment for that recipe, which the manual actions recover.
 */
export async function announceUsableRecipe(payload: RecipeBecameUsablePayload): Promise<void> {
  try {
    await publishRecipeBecameUsable(payload);
    log.debug({ recipeId: payload.recipeId }, "Announced usable recipe");
  } catch (err) {
    log.error({ err, recipeId: payload.recipeId }, "Failed to announce usable recipe");
  }
}
