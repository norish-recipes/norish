import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { cuisines } from "./cuisines";

/**
 * What the one-time cuisine-Tag migration removed, per recipe.
 *
 * Recorded because the removal is not reversible from within the application:
 * the migration deletes both the `recipe_tags` associations and the orphaned
 * `tags` rows, and nothing else remembers which Tags a recipe used to carry.
 *
 * Deliberately not joined to `recipes`: the record should outlive a recipe that
 * is later deleted. `cuisine_id` nulls out if an administrator removes the
 * Cuisine, so the audit row survives that too.
 */
export const cuisineTagMigrations = pgTable(
  "cuisine_tag_migrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id").notNull(),
    tagName: text("tag_name").notNull(),
    cuisineId: uuid("cuisine_id").references(() => cuisines.id, { onDelete: "set null" }),
    migratedAt: timestamp("migrated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_cuisine_tag_migrations_recipe_id").on(t.recipeId)]
);
