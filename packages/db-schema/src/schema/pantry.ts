import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { households } from "./households";
import { ingredientAliases, ingredients } from "./ingredients";
import { mutableRowColumns } from "./shared";

/**
 * A Pantry Ingredient: one Ingredient the household already has at home, kept
 * so a recipe's staples are recognised and left off the list. It belongs to
 * the household, with the member who typed it kept as who added it. It holds
 * the Ingredient Alias the typed text resolved to and that alias's Ingredient,
 * and nothing else — no amount, no date (ADR-0037). One Ingredient appears at
 * most once per household.
 */
export const pantryIngredients = pgTable(
  "pantry_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    /** Who added it; null once their account is deleted (ADR-0041). */
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    ingredientAliasId: uuid("ingredient_alias_id").references(() => ingredientAliases.id, {
      onDelete: "cascade",
    }),
    ...mutableRowColumns,
  },
  (t) => [
    index("idx_pantry_ingredients_user_id").on(t.userId),
    index("idx_pantry_ingredients_ingredient_id").on(t.ingredientId),
    index("idx_pantry_ingredients_ingredient_alias_id").on(t.ingredientAliasId),
    unique("uq_pantry_ingredients_household_ingredient").on(t.householdId, t.ingredientId),
  ]
);
