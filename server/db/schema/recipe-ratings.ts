import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipes } from "./recipes";

export const recipeRatings = pgTable(
  "recipe_ratings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_recipe_ratings_user_recipe").on(t.userId, t.recipeId),
    index("idx_recipe_ratings_user_id").on(t.userId),
    index("idx_recipe_ratings_recipe_id").on(t.recipeId),
  ]
);
