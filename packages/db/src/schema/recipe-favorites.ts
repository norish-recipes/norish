import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipes } from "./recipes";

export const recipeFavorites = pgTable(
  "recipe_favorites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_recipe_favorites_user_recipe").on(t.userId, t.recipeId),
    index("idx_recipe_favorites_user_id").on(t.userId),
    index("idx_recipe_favorites_recipe_id").on(t.recipeId),
  ]
);
