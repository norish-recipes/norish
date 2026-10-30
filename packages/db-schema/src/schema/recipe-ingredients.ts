import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { ingredientAliases } from "./ingredients";
import { measurementSystemEnum, recipes } from "./recipes";
import { versionColumn } from "./shared";

/** How a line naming several foods joins them: all of them, or any one. */
export const recipeIngredientJoinEnum = pgEnum("recipe_ingredient_join", [
  "together",
  "alternatives",
]);

/** The join a line's foods have; `LineJoin` in `@norish/shared`, which this package cannot import. */
export type RecipeIngredientJoin = (typeof recipeIngredientJoinEnum.enumValues)[number];

/**
 * A recipe line. `name` is the line's text as written ("onions, diced"),
 * which is what the recipe shows; its foods are its `recipeIngredientFoods`,
 * in order (ADR-0037). A line with none names no food: a `#` heading, or one
 * whose foods were deleted. `joined` says how several foods go together, and
 * is empty for one or none.
 */
export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    joined: recipeIngredientJoinEnum("joined"),
    amount: numeric("amount", { precision: 10, scale: 3 }),
    unit: text("unit"),
    order: numeric("order"),
    systemUsed: measurementSystemEnum("system_used").notNull().default("metric"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [index("idx_recipe_ingredients_recipe_id").on(t.recipeId)]
);

/**
 * One food a recipe line names: the alias its text resolved to, at its position in the line.
 * Deleting the alias deletes the row without renumbering; "the line's food" is the lowest left.
 */
export const recipeIngredientFoods = pgTable(
  "recipe_ingredient_foods",
  {
    recipeIngredientId: uuid("recipe_ingredient_id")
      .notNull()
      .references(() => recipeIngredients.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    ingredientAliasId: uuid("ingredient_alias_id")
      .notNull()
      .references(() => ingredientAliases.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.recipeIngredientId, t.position] }),
    index("idx_recipe_ingredient_foods_ingredient_alias_id").on(t.ingredientAliasId),
  ]
);
