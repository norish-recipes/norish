import { asc, eq, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { recipeImages, recipes } from "@norish/db/schema";

const gallery = alias(recipeImages, "gallery");

/**
 * SQL twin of `primaryRecipeImage` (@norish/shared/lib/recipe-media): the
 * first gallery image by order. Every list-shaped projection serves its
 * `image` through this — recipe lists, and the calendar's planned items, which
 * join the recipe for its thumbnail; a change here must move with the shared
 * helper.
 *
 * A builder subquery, so its correlation renders qualified as `"recipes"."id"`:
 * a query using this must reference the recipes table under its own name, never an alias.
 */
export const PRIMARY_IMAGE_SQL = sql<string | null>`${new QueryBuilder()
  .select({ image: gallery.image })
  .from(gallery)
  .where(eq(gallery.recipeId, recipes.id))
  .orderBy(sql`COALESCE(${gallery.order}, 0) ASC`, asc(gallery.createdAt))
  .limit(1)}`;
