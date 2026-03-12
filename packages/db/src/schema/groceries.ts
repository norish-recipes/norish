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
import { recipeIngredients } from "./recipe-ingredients";
import { recurringGroceries } from "./recurring-groceries";
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
    name: text("name"),
    unit: text("unit"),
    amount: numeric("amount", { precision: 10, scale: 3 }),
    isDone: boolean("is_done").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_groceries_user_id").on(t.userId),
    index("idx_groceries_recipe_ingredient_id").on(t.recipeIngredientId),
    index("idx_groceries_recurring_grocery_id").on(t.recurringGroceryId),
    index("idx_groceries_store_id").on(t.storeId),
    index("idx_groceries_is_done").on(t.isDone),
    index("idx_groceries_sort_order").on(t.sortOrder),
  ]
);
