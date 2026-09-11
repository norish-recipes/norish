import { index, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { ingredients } from "./ingredients";
import { mutableRowColumns } from "./shared";

/**
 * A Pantry Ingredient: one Ingredient Name the household already has at home, kept
 * so a recipe's staples are recognised and left off the list. It belongs to
 * the member who typed it and is read across the household, exactly as a Store
 * is. It holds a reference and nothing else — no name of its own, no amount,
 * no date — because a pantry name is the same kind of thing a recipe line
 * names, and a recipe line is `recipe_ingredients.ingredient_id`. Typing a
 * name Norish has not seen mints the Ingredient Name, as editing a recipe
 * does.
 *
 * One Ingredient Name appears at most once per member; the household-wide
 * rule, and the stricter rule that one *folded* name appears once, are kept by
 * the procedure, as a Store's name is. The fold itself lives on the Ingredient
 * Name (`ingredients.normalized_name`).
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
    ...mutableRowColumns,
  },
  (t) => [
    index("idx_pantry_ingredients_user_id").on(t.userId),
    index("idx_pantry_ingredients_ingredient_id").on(t.ingredientId),
    unique("uq_pantry_ingredients_user_ingredient").on(t.userId, t.ingredientId),
  ]
);
