/**
 * Announce a Usable Recipe.
 *
 * Every creation path calls this once a genuinely new recipe has committed and
 * can be loaded. It is the only handoff from creation to enrichment: creation
 * modules extract and persist, and stop there.
 */

import type { CreateRecipeResult } from "@norish/db/repositories/recipes";
import type { RecipeBecameUsablePayload } from "@norish/shared-server/realtime/recipe-enrichment";
import { createLogger } from "@norish/shared-server/logger";
import { publishRecipeBecameUsable } from "@norish/shared-server/realtime/recipe-enrichment";

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
