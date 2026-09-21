/**
 * Pantry realtime catalogue. A Pantry is the household's, so both events are
 * household-scoped. Both are merged by id on arrival, so the actor's own echo
 * and a replay off the Resume Buffer are no-ops.
 */

import { z } from "zod";

import { PantryIngredientSelectSchema } from "../zod/pantry";
import { defineRealtimeCatalogue } from "./catalogue";

export const pantryRealtime = defineRealtimeCatalogue("pantry", {
  /** A name put in the Pantry; merged by id. */
  added: { scope: "household", payload: z.object({ item: PantryIngredientSelectSchema }) },
  /** A name taken out of the Pantry; filtered by id. */
  removed: { scope: "household", payload: z.object({ itemId: z.string() }) },
});

export type PantryRealtime = typeof pantryRealtime;
