/**
 * Automatic Enrichment Enrollment listener.
 *
 * Follows the CalDAV integration's shape — a subscription started as part of
 * normal server startup, with reconnect and error logging — with two
 * corrections this flow needs:
 *
 * 1. It subscribes to the internal channel, not a permission-scoped client one,
 *    so client visibility policy cannot decide whether enrollment happens.
 * 2. Initialization is awaited and only reports success once the subscription
 *    actually succeeded, so the server never claims a listener it does not have.
 */

import type Redis from "ioredis";
import superjson from "superjson";

import type { RecipeBecameUsablePayload } from "@norish/shared-server/realtime/recipe-enrichment";
import { enrichRecipe } from "@norish/queue/enrichment/coordinator";
import { createLogger } from "@norish/shared-server/logger";
import { RECIPE_BECAME_USABLE_CHANNEL } from "@norish/shared-server/realtime/recipe-enrichment";
import { createSubscriberClient } from "@norish/shared-server/redis/client";
import { unwrapPayload } from "@norish/shared/lib/operation-helpers";

const log = createLogger("recipe-enrichment-listener");

let subscriber: Redis | null = null;

/**
 * Subscribe to the internal creation event and enroll Automatic Recipe
 * Enrichment for every recipe that becomes usable.
 *
 * Call before recipe-producing workers and HTTP handlers can publish. Throws if
 * the subscription cannot be established; the caller decides whether that is
 * fatal, but it must not be reported as a successful initialization.
 */
export async function initRecipeEnrichmentListener(): Promise<void> {
  if (subscriber) {
    log.warn("Recipe Enrichment listener already initialized");

    return;
  }

  const client = await createSubscriberClient();

  client.on("error", (err) => {
    log.error({ err }, "Recipe Enrichment listener connection error");
  });

  client.on("reconnecting", () => {
    log.warn("Recipe Enrichment listener reconnecting");
  });

  client.on("message", (channel, message) => {
    if (channel !== RECIPE_BECAME_USABLE_CHANNEL) return;

    // Fire and forget: a slow or failing enrollment must not stall the
    // subscriber, and creation has already succeeded regardless.
    void handleRecipeBecameUsable(message);
  });

  // Await the subscription itself. Only after this resolves may we claim the
  // listener is ready.
  await client.subscribe(RECIPE_BECAME_USABLE_CHANNEL);

  subscriber = client;
  log.info({ channel: RECIPE_BECAME_USABLE_CHANNEL }, "Recipe Enrichment listener initialized");
}

export async function stopRecipeEnrichmentListener(): Promise<void> {
  if (!subscriber) return;

  const client = subscriber;

  subscriber = null;

  try {
    await client.unsubscribe(RECIPE_BECAME_USABLE_CHANNEL);
    await client.quit();
  } catch (err) {
    log.debug({ err }, "Error during Recipe Enrichment listener shutdown");
  }
}

async function handleRecipeBecameUsable(message: string): Promise<void> {
  let payload: RecipeBecameUsablePayload;

  try {
    payload = unwrapPayload<RecipeBecameUsablePayload>(superjson.parse(message));
  } catch (err) {
    log.error({ err }, "Failed to parse recipe-became-usable event");

    return;
  }

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
