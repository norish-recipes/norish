/**
 * Announce a Usable Recipe.
 *
 * Every creation path calls this once a genuinely new recipe has committed and
 * can be loaded. It is the only handoff from creation to enrichment: creation
 * modules extract and persist, and stop there.
 */

import type { ListKind } from "@norish/db/repositories/list-entries";
import type { CreateRecipeResult } from "@norish/db/repositories/recipes";
import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { RecipeBecameUsablePayload } from "@norish/shared/contracts/realtime/recipe-enrichment";
import type {
  RecipeEnrichmentKind,
  RecipeEnrichmentLifecycleState,
} from "@norish/shared/lib/recipe-enrichment";
import { createLogger } from "@norish/shared-server/logger";
import { accountAudience, recipeAudience } from "@norish/shared-server/realtime/audience";
import { announceRecipeListsChanged } from "@norish/shared-server/realtime/list-changes";
import { recipeEnrichment } from "@norish/shared-server/realtime/recipe-enrichment";
import { recipes } from "@norish/shared-server/realtime/recipes";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";

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
 * drops a Valkey failure, and a payload failing its schema only throws outside
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
  // The recipe's household now, whoever asked; the requester's once the recipe is gone.
  const audience =
    (await recipeAudience(data.recipeId)) ??
    (await accountAudience(data.requestedByUserId ?? data.userId));

  if (!audience) return;

  await recipes.publish(
    "enrichment",
    {
      recipeId: data.recipeId,
      runId: data.runId,
      runSequence: data.runSequence,
      kind: data.kind,
      state,
      origin: data.origin,
      ...(data.origin === "manual" && state === "failed"
        ? { requestedByUserId: data.requestedByUserId ?? data.userId }
        : {}),
    },
    audience
  );
}

/** The lists each enrichment writes into: its entries may be new, and count one recipe more. */
const LISTS_WRITTEN: Partial<Record<RecipeEnrichmentKind, readonly ListKind[]>> = {
  "auto-tagging": ["tag"],
  "allergy-detection": ["tag"],
  "auto-categorization": ["category"],
  "recipe-provenance": ["cuisine"],
};

/** Publish the canonical recipe value after an enrichment write, and the lists it wrote into. */
export async function publishEnrichmentRecipeUpdated(
  data: RecipeEnrichmentJobData,
  recipe: FullRecipeDTO
): Promise<void> {
  const written = LISTS_WRITTEN[data.kind];

  if (written) await announceRecipeListsChanged(recipe.id, written);

  const audience = await recipeAudience(recipe.id);

  if (!audience) return;

  await recipes.publish(
    "updated",
    {
      recipe,
      source: "enrichment",
      kind: data.kind,
    },
    audience
  );
}
