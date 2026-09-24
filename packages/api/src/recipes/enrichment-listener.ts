/**
 * Automatic Enrichment Enrollment listener.
 *
 * A `hub.on()` registration on the internal `recipeBecameUsable` channel, not
 * a permission-scoped client one, so client visibility policy cannot decide
 * whether enrollment happens. Initialization only reports success once the
 * registration is in place, so the server never claims a listener it does not
 * have.
 */

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { enrichRecipe } from "@norish/queue/enrichment/coordinator";
import { createLogger } from "@norish/shared-server/logger";
import { getRealtimeHub } from "@norish/shared-server/realtime/hub";
import { recipeEnrichment } from "@norish/shared-server/realtime/recipe-enrichment";
import { RecipeBecameUsablePayloadSchema } from "@norish/shared/contracts/realtime/recipe-enrichment";

const log = createLogger("recipe-enrichment-listener");

export const RECIPE_BECAME_USABLE_CHANNEL = recipeEnrichment.channel(
  "recipeBecameUsable",
  undefined
);

let release: (() => void) | null = null;

/**
 * Register on the hub and enroll Automatic Recipe Enrichment for every recipe
 * that becomes usable.
 *
 * Call after `startRealtimeHub()` and before recipe-producing workers and HTTP
 * handlers can publish. Throws if the hub is not started; the caller decides
 * whether that is fatal, but it must not be reported as a successful
 * initialization.
 */
export async function initRecipeEnrichmentListener(): Promise<void> {
  if (release) {
    log.warn("Recipe Enrichment listener already initialized");

    return;
  }

  release = getRealtimeHub().on(RECIPE_BECAME_USABLE_CHANNEL, (envelope) => {
    // Fire and forget: a slow or failing enrollment must not stall the hub,
    // and creation has already succeeded regardless.
    void handleRecipeBecameUsable(envelope);
  });

  log.info({ channel: RECIPE_BECAME_USABLE_CHANNEL }, "Recipe Enrichment listener initialized");
}

export async function stopRecipeEnrichmentListener(): Promise<void> {
  if (!release) return;

  const off = release;

  release = null;
  off();
}

async function handleRecipeBecameUsable(envelope: RealtimeEventEnvelope): Promise<void> {
  const parsed = RecipeBecameUsablePayloadSchema.safeParse(envelope.payload);

  if (!parsed.success) {
    log.error({ issues: parsed.error.issues }, "Dropped malformed recipe-became-usable event");

    return;
  }

  const payload = parsed.data;

  try {
    const results = await enrichRecipe(
      {
        recipeId: payload.recipeId,
        userId: payload.userId,
        householdKey: payload.householdKey,
        householdUserIds: payload.householdUserIds,
      },
      { origin: "automatic" }
    );

    log.info(
      { recipeId: payload.recipeId, results },
      "Automatic Recipe Enrichment enrollment complete"
    );
  } catch (err) {
    // Automatic enrollment is quiet: creation already succeeded and the user is
    // not waiting on this. Several instances may observe the same event, so
    // duplicate work is expected and made harmless by deterministic job ids.
    log.error({ err, recipeId: payload.recipeId }, "Automatic enrichment enrollment failed");
  }
}
