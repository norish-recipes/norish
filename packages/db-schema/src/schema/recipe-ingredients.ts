import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { ingredientAliases } from "./ingredients";
import { measurementSystemEnum, recipes } from "./recipes";
import { versionColumn } from "./shared";

/**
 * A recipe line. `name` is the line's text as written ("onions, diced"),
 * which is what the recipe shows; `ingredientAliasId` is the Ingredient Alias
 * the resolver resolved that text to, and through it the Ingredient. The alias
 * is the line's only pointer at its food (ADR-0037); it is null only on a `#`
 * heading, which names no food, and on a line the upgrade has not reached yet.
 */
export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ingredientAliasId: uuid("ingredient_alias_id").references(() => ingredientAliases.id),
    amount: numeric("amount", { precision: 10, scale: 3 }),
    unit: text("unit"),
    order: numeric("order"),
    systemUsed: measurementSystemEnum("system_used").notNull().default("metric"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_recipe_ingredients_recipe_id").on(t.recipeId),
    index("idx_recipe_ingredients_ingredient_alias_id").on(t.ingredientAliasId),
  ]
);
