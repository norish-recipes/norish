import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { ingredients } from "./ingredients";
import { recipes, measurementSystemEnum } from "./recipes";

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 10, scale: 3 }),
    unit: text("unit"),
    order: numeric("order"),
    systemUsed: measurementSystemEnum("system_used").notNull().default("metric"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recipe_ingredients_recipe_id").on(t.recipeId),
    index("idx_recipe_ingredients_ingredient_id").on(t.ingredientId),
  ]
);
