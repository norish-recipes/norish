import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { cuisines } from "@norish/db-schema/schema";

export const CuisineSelectBaseSchema = createSelectSchema(cuisines);

/**
 * A Cuisine as it travels with a recipe.
 *
 * The id rides along because an editor picks Cuisines from the vocabulary
 * rather than typing them, and the name is the canonical identifier shown
 * verbatim in every locale.
 */
export const CuisineSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  version: z.number(),
});

/** Bounds shared by every write path so one rule governs the vocabulary. */
export const CuisineNameSchema = z.string().trim().min(1).max(80);
