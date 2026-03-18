import { index, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { measurementSystemEnum, recipes } from "./recipes";

export const steps = pgTable(
  "steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    systemUsed: measurementSystemEnum("system_used").notNull().default("metric"),
    order: numeric("order"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_steps_recipe_id").on(t.recipeId),
    uniqueIndex("unique_recipe_step_system").on(t.recipeId, t.step, t.systemUsed),
  ]
);
