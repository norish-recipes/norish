import { index, integer, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { categories } from "./categories";
import { recipes } from "./recipes";
import { versionColumn } from "./shared";

export const recipeCategories = pgTable(
  "recipe_categories",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "no action" }),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.categoryId], name: "pk_recipe_categories" }),
    index("idx_recipe_categories_category_id").on(t.categoryId),
  ]
);
