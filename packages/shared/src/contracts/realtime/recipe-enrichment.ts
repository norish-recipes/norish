/**
 * Recipe enrichment realtime catalogue: the server-internal handoff from
 * creation to enrichment.
 *
 * Deliberately separate from the permission-scoped client recipe channel: who
 * may *see* a recipe must not decide whether the enrichment coordinator hears
 * about it. `internal` events are not buffered or replayed; a brief process or
 * Redis interruption is an accepted enrollment loss window, and duplicate
 * delivery is made harmless by deterministic per-recipe-and-kind job identity.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

/**
 * Recipe identity plus the minimal initiating context needed to enroll jobs.
 * It carries no parser output: the coordinator always reloads current stored
 * state, so eligibility cannot drift from what was actually persisted.
 */
export const RecipeBecameUsablePayloadSchema = z.object({
  recipeId: z.string(),
  userId: z.string(),
  householdKey: z.string(),
  householdUserIds: z.array(z.string()).nullable(),
});

export type RecipeBecameUsablePayload = z.infer<typeof RecipeBecameUsablePayloadSchema>;

export const recipeEnrichmentRealtime = defineRealtimeCatalogue("recipe-enrichment", {
  recipeBecameUsable: { scope: "internal", payload: RecipeBecameUsablePayloadSchema },
});

export type RecipeEnrichmentRealtime = typeof recipeEnrichmentRealtime;
