import { index, pgTable, text, timestamp, uuid, date, integer, pgEnum } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipes } from "./recipes";

export const slotTypeEnum = pgEnum("slot_type", ["Breakfast", "Lunch", "Dinner", "Snack"]);

export const itemTypeEnum = pgEnum("item_type", ["recipe", "note"]);

export const plannedItems = pgTable(
  "planned_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    slot: slotTypeEnum("slot").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    itemType: itemTypeEnum("item_type").notNull(),

    // Recipe-specific (NULL for notes)
    recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "cascade" }),

    // Note-specific (NULL for recipes, optional for notes with linked recipe)
    title: text("title"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_planned_items_user_date").on(t.userId, t.date),
    index("idx_planned_items_user").on(t.userId),
    index("idx_planned_items_date_slot_order").on(t.date, t.slot, t.sortOrder),
    index("idx_planned_items_recipe").on(t.recipeId),
  ]
);
