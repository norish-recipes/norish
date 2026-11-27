/**
 * Ingredients realtime catalogue. Each household's catalogue is the seed plus
 * its own foods (ADR-0042), so a change to a household's foods reaches that
 * household and a change to the seed reaches everyone. The event names the
 * Ingredients involved and nothing more: a client refetches whatever it holds
 * that is derived from them, so its own echo and a replay off the Resume
 * Buffer are a refetch that changes nothing.
 */

import { z } from "zod";

import { defineRealtimeCatalogue } from "./catalogue";

export const ingredientsRealtime = defineRealtimeCatalogue("ingredients", {
  /** Any edit to these Ingredients: what they are (a merge, an alias move, a rename, a parent, a deletion) or how they read (a spelling, a flag). */
  changed: { scope: "policy", payload: z.object({ ingredientIds: z.array(z.string()) }) },
  /**
   * A member of the household corrected these Ingredients' nutrition, or
   * removed a correction (ADR-0039): only that household reads it, so only
   * it hears. Everything derived from their numbers is read again.
   */
  corrected: { scope: "household", payload: z.object({ ingredientIds: z.array(z.string()) }) },
});

export type IngredientsRealtime = typeof ingredientsRealtime;
