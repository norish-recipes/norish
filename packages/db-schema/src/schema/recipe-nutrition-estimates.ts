import { jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";

/**
 * The language model's estimate of the lines a recipe's worked-out nutrition
 * could not count (ADR-0039): one per-serving share per line, under the
 * line's `lineKey`, so a household's worked-out total adds the share of each
 * line still left out for it and nothing for a line its own correction
 * counts. Kept apart from the recipe's own Nutrition Information, which is
 * what the recipe supplies; one per recipe, replaced by the next estimate.
 */

/** One line's share: its key and what the model gave it, per serving. */
export interface EstimatedLineRow {
  key: string;
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
}

export const recipeNutritionEstimates = pgTable("recipe_nutrition_estimates", {
  recipeId: uuid("recipe_id")
    .primaryKey()
    .references(() => recipes.id, { onDelete: "cascade" }),
  lines: jsonb("lines").$type<EstimatedLineRow[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
