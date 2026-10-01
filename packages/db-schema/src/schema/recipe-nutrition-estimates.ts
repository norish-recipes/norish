import { doublePrecision, jsonb, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";

/**
 * The language model's estimate of the lines a recipe's worked-out nutrition
 * could not count (ADR-0039): its per-serving share of them, and the lines
 * it covered (`lineKey`), so it is added to a household's worked-out total
 * only while exactly those lines are still left out. Kept apart from the
 * recipe's own Nutrition Information, which is what the recipe supplies;
 * one per recipe, replaced by the next estimate.
 */
export const recipeNutritionEstimates = pgTable("recipe_nutrition_estimates", {
  recipeId: uuid("recipe_id")
    .primaryKey()
    .references(() => recipes.id, { onDelete: "cascade" }),
  calories: doublePrecision("calories").notNull(),
  fat: doublePrecision("fat").notNull(),
  carbs: doublePrecision("carbs").notNull(),
  protein: doublePrecision("protein").notNull(),
  lines: jsonb("lines").$type<string[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
