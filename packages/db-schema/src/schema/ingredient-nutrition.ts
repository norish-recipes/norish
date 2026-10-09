import {
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { ingredients } from "./ingredients";
import { mutableRowColumns } from "./shared";

/**
 * Ingredient Nutrition's source numbers (ADR-0039), as the committed source
 * table last applied them: replaced whole whenever a release carries a new
 * version of the table, never edited on an instance, and never holding a
 * household's correction.
 *
 * `nutritionFoods` is every dataset food: its four numbers per 100 g, and the
 * piece weight and density USDA's portions give it. A USDA food is keyed by
 * FDC id and carries the SR Legacy NDB number the taxonomy names it by.
 */
export const nutritionFoods = pgTable(
  "nutrition_foods",
  {
    dataset: text("dataset").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    kcal: doublePrecision("kcal").notNull(),
    fat: doublePrecision("fat").notNull(),
    carbs: doublePrecision("carbs").notNull(),
    protein: doublePrecision("protein").notNull(),
    pieceWeight: doublePrecision("piece_weight"),
    density: doublePrecision("density"),
    ndb: text("ndb"),
  },
  (t) => [primaryKey({ columns: [t.dataset, t.code] }), index("idx_nutrition_foods_ndb").on(t.ndb)]
);

/**
 * Norish's own rules about taxonomy entries: the fix list (`fix`, the food an
 * entry should read above its codes), the build script's name matches
 * (`name`), and the lenders that never lend (`never-lend`, no food). The food
 * is `dataset:code`.
 */
export const nutritionRules = pgTable(
  "nutrition_rules",
  {
    offId: text("off_id").notNull(),
    kind: text("kind").notNull(),
    food: text("food"),
  },
  (t) => [primaryKey({ columns: [t.offId, t.kind] })]
);

/**
 * A household's corrections to Ingredient Nutrition (ADR-0039): the last
 * word for that household, kept apart from the source numbers so a table
 * refresh never touches them and the catalogue export never carries them.
 * Keyed by the member who made it and read by everyone in their household,
 * the most recent winning; any member may correct any Ingredient, seeded or
 * not, with no edit policy in the way. Each of the three facts is either a
 * dataset food (`dataset:code`) or a number, or left to the sources: the
 * numbers per 100 g as all four of `kcal`, `fat`, `carbs` and `protein`, the
 * piece weight in grams, the density in grams per millilitre.
 */
export const ingredientNutritionCorrections = pgTable(
  "ingredient_nutrition_corrections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    numbersFood: text("numbers_food"),
    kcal: doublePrecision("kcal"),
    fat: doublePrecision("fat"),
    carbs: doublePrecision("carbs"),
    protein: doublePrecision("protein"),
    pieceWeightFood: text("piece_weight_food"),
    pieceWeight: doublePrecision("piece_weight"),
    densityFood: text("density_food"),
    density: doublePrecision("density"),
    ...mutableRowColumns,
  },
  (t) => [
    unique("uq_ingredient_nutrition_corrections_user_ingredient").on(t.userId, t.ingredientId),
    index("idx_ingredient_nutrition_corrections_ingredient_id").on(t.ingredientId),
  ]
);
