/**
 * Ingredients realtime catalogue. The catalogue of Ingredients is one for the
 * whole instance, so a change to what a spelling means is a broadcast. The
 * event names the Ingredients involved and nothing more: a client refetches
 * whatever it holds that is derived from them, so its own echo and a replay
 * off the Resume Buffer are a refetch that changes nothing.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

export const ingredientsRealtime = defineRealtimeCatalogue("ingredients", {
  /** A merge, an alias move, a rename or a new parent: which lines mean which food may have changed. */
  changed: { scope: "broadcast", payload: z.object({ ingredientIds: z.array(z.string()) }) },
});

export type IngredientsRealtime = typeof ingredientsRealtime;
