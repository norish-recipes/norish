import { sql } from "drizzle-orm";

import { recipeImages } from "@norish/db/schema";

/**
 * SQL twin of `primaryRecipeImage` (@norish/shared/lib/recipe-media): the
 * first gallery image by order, falling back to the legacy `recipes.image`
 * scalar. Every list-shaped projection serves its `image` through this —
 * recipe lists, and the calendar's planned items, which join the recipe for
 * its thumbnail — so nothing reads the deprecated scalar directly; a change
 * here must move with the shared helper.
 *
 * The outer references are spelled `"recipes"."id"`/`"recipes"."image"` by
 * hand: interpolating the drizzle columns renders them unqualified in plain
 * selects, and inside the subquery an unqualified `"id"` resolves to the
 * gallery's own column — silently matching nothing. Any query using this must
 * therefore reference the recipes table under its own name, never an alias.
 */
export const PRIMARY_IMAGE_SQL = sql<string | null>`COALESCE(
  (SELECT gallery.image FROM ${recipeImages} AS gallery
    WHERE gallery.recipe_id = "recipes"."id"
    ORDER BY COALESCE(gallery."order", 0) ASC, gallery.created_at ASC
    LIMIT 1),
  "recipes"."image"
)`;
