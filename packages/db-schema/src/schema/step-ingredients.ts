import { index, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipeIngredients } from "./recipe-ingredients";
import { versionColumn } from "./shared";
import { steps } from "./steps";

/**
 * A Step Ingredient: a step's use of one of the recipe's ingredient lines,
 * carried as a fractional share of that line (half the water is 0.5).
 *
 * References live in measurement-system space like every other piece of
 * recipe data — a metric step references metric lines — which both sides of
 * the reference already record, so no system column is repeated here. The
 * displayed amount is always derived at render time as share × the line's
 * current amount, never stored, so it follows edits and the active system.
 * Deleting the step or the ingredient line deletes the reference with it.
 *
 * The share is an unconstrained numeric on purpose. An amount typed against
 * a line ("150 of the 650 g") becomes the quotient, and only a share kept to
 * the full precision of that division multiplies back to the typed amount:
 * a four-decimal column turned 150 g into 150.02 g on the reading surface
 * (issue #550).
 */
export const stepIngredients = pgTable(
  "step_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    stepId: uuid("step_id")
      .notNull()
      .references(() => steps.id, { onDelete: "cascade" }),
    recipeIngredientId: uuid("recipe_ingredient_id")
      .notNull()
      .references(() => recipeIngredients.id, { onDelete: "cascade" }),
    share: numeric("share").notNull().default("1"),
    order: numeric("order").default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_step_ingredients_step_id").on(t.stepId),
    index("idx_step_ingredients_recipe_ingredient_id").on(t.recipeIngredientId),
  ]
);
