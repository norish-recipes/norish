import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { equipmentAliases } from "./equipment";
import { recipes } from "./recipes";
import { versionColumn } from "./shared";

/**
 * A recipe equipment line. `name` is the line's text as written ("Springform (26 cm)"),
 * which is what the recipe shows; `equipmentAliasId` is the Equipment Alias
 * that text resolved to, and through it the Equipment item. It is null only on
 * a `#` heading, which names no tool.
 */
export const recipeEquipment = pgTable(
  "recipe_equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    equipmentAliasId: uuid("equipment_alias_id").references(() => equipmentAliases.id),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_recipe_equipment_recipe_id").on(t.recipeId),
    index("idx_recipe_equipment_equipment_alias_id").on(t.equipmentAliasId),
  ]
);
