import { index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { ingredients } from "./ingredients";
import { versionColumn } from "./shared";

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("primary"),
    /** The shop's own website, when the Store stands for a real one. */
    website: text("website"),
    /** The shop's search page with a `{query}` slot where the term goes. */
    searchAddress: text("search_address"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [index("idx_stores_user_id").on(t.userId), index("idx_stores_sort_order").on(t.sortOrder)]
);

/**
 * A store preference: the Store a member sends an Ingredient to, per member
 * and per Ingredient (ADR-0037), so a preference for "milk" holds for "melk".
 */
export const ingredientStorePreferences = pgTable(
  "ingredient_store_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id").references(() => ingredients.id, { onDelete: "cascade" }),
    /** The name the preference was keyed by before ADR-0037; read by nothing. */
    normalizedName: text("normalized_name"),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_ingredient_store_prefs_user_id").on(t.userId),
    index("idx_ingredient_store_prefs_store_id").on(t.storeId),
    unique("uq_ingredient_store_prefs_user_ingredient").on(t.userId, t.ingredientId),
  ]
);
