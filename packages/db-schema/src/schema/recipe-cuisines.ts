import { index, integer, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { cuisines } from "./cuisines";
import { recipes } from "./recipes";
import { versionColumn } from "./shared";

/**
 * A recipe's Cuisines.
 *
 * Mirrors `recipe_tags`, except that deleting a Cuisine is a silent cascade:
 * an administrator removing a vocabulary entry removes it from every recipe
 * that referenced it, with no usage count and no extra confirmation.
 */
export const recipeCuisines = pgTable(
  "recipe_cuisines",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    cuisineId: uuid("cuisine_id")
      .notNull()
      .references(() => cuisines.id, { onDelete: "cascade" }),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.cuisineId], name: "pk_recipe_cuisines" }),
    index("idx_recipe_cuisines_recipe_id").on(t.recipeId),
    index("idx_recipe_cuisines_cuisine_id").on(t.cuisineId),
  ]
);
