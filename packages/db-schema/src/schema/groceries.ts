import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { ingredientAliases, ingredients } from "./ingredients";
import { recipeIngredients } from "./recipe-ingredients";
import { recurringGroceries } from "./recurring-groceries";
import { versionColumn } from "./shared";
import { stores } from "./stores";

export const groceries = pgTable(
  "groceries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeIngredientId: uuid("recipe_ingredient_id").references(() => recipeIngredients.id, {
      onDelete: "set null",
    }),
    recurringGroceryId: uuid("recurring_grocery_id").references(() => recurringGroceries.id, {
      onDelete: "set null",
    }),
    storeId: uuid("store_id").references(() => stores.id, {
      onDelete: "set null",
    }),
    /** The line's text as written, which is what the list shows. */
    name: text("name"),
    /** The Ingredient Alias the name resolved to (ADR-0037); null for a line with no name. */
    ingredientAliasId: uuid("ingredient_alias_id").references(() => ingredientAliases.id),
    /**
     * The alias's Ingredient, kept beside it so every read of the list has
     * the food a price, an aisle and a store preference are keyed by. Written
     * with the alias; a merge re-points both.
     */
    ingredientId: uuid("ingredient_id").references(() => ingredients.id),
    unit: text("unit"),
    amount: numeric("amount", { precision: 10, scale: 3 }),
    purchaseAmount: numeric("purchase_amount", { precision: 10, scale: 3 }),
    isDone: boolean("is_done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_groceries_user_id").on(t.userId),
    index("idx_groceries_recipe_ingredient_id").on(t.recipeIngredientId),
    index("idx_groceries_recurring_grocery_id").on(t.recurringGroceryId),
    index("idx_groceries_store_id").on(t.storeId),
    index("idx_groceries_ingredient_alias_id").on(t.ingredientAliasId),
    index("idx_groceries_ingredient_id").on(t.ingredientId),
    index("idx_groceries_is_done").on(t.isDone),
    index("idx_groceries_sort_order").on(t.sortOrder),
  ]
);
