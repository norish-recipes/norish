import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { ingredientAliases, ingredients } from "./ingredients";
import { mutableRowColumns } from "./shared";

/**
 * A Pantry Ingredient: one Ingredient the household already has at home, kept
 * so a recipe's staples are recognised and left off the list. It belongs to
 * the member who typed it and is read across the household, exactly as a
 * Store is. It holds the Ingredient Alias the typed text resolved to and that
 * alias's Ingredient, and nothing else — no amount, no date (ADR-0037).
 *
 * One Ingredient appears at most once per member, held by the row
 * constraint; the household-wide rule is kept by the procedure, as a Store's
 * name is.
 */
export const pantryIngredients = pgTable(
  "pantry_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    ingredientAliasId: uuid("ingredient_alias_id").references(() => ingredientAliases.id),
    ...mutableRowColumns,
  },
  (t) => [
    index("idx_pantry_ingredients_user_id").on(t.userId),
    index("idx_pantry_ingredients_ingredient_id").on(t.ingredientId),
    unique("uq_pantry_ingredients_user_ingredient").on(t.userId, t.ingredientId),
  ]
);
