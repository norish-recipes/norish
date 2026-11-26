import type { SQL } from "drizzle-orm";
import { eq, isNotNull, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { LineReadings } from "@norish/shared/lib/line-foods";

import {
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
} from "../schema";
import { isAnyOf, pickedByKey } from "./array-params";

const coveredParent = alias(ingredients, "covered_parent");
const qb = new QueryBuilder();

/**
 * `covered(ingredient_id, depth)`: every food the household's Pantry covers, the
 * kept Ingredients and each food they are a kind of. Goes after `with recursive`.
 */
export function coveredCte(householdId: string): SQL {
  return sql`covered(ingredient_id, depth) as (
      select ${pantryIngredients.ingredientId}, 0 from ${pantryIngredients}
      where ${eq(pantryIngredients.householdId, householdId)}
      union
      select ${coveredParent.parentId}, covered.depth + 1 from covered
      join ${ingredients} as ${coveredParent} on ${coveredParent.id} = covered.ingredient_id
      where ${isNotNull(coveredParent.parentId)} and covered.depth < 32
    )`;
}

/**
 * Whether a line read through the reader's catalogue (`readings`, ADR-0042) is covered, by the same
 * rule; a reading of no food is not. Its foods are bound as one array per column, keyed by line.
 */
function readCovered(readings: LineReadings, covered: SQL): { read: SQL; covered: SQL } {
  const ids = Object.keys(readings);
  const picked = (values: string[]) => pickedByKey(recipeIngredients.id, ids, "uuid", values);
  const foods = sql`(${picked(ids.map((id) => `{${readings[id]!.foods.map((food) => food.ingredientId).join(",")}}`))})::uuid[]`;
  const alternatives = sql`(${picked(ids.map((id) => String(readings[id]!.joined === "alternatives")))})::boolean`;
  const held = sql`array(${covered})`;

  return {
    read: isAnyOf(recipeIngredients.id, ids, "uuid"),
    covered: sql`CASE WHEN ${alternatives} THEN ${foods} && ${held}
      ELSE cardinality(${foods}) > 0 AND ${foods} <@ ${held} END`,
  };
}

/**
 * The share of a recipe's food lines in the household's Pantry, 0 to 1, or
 * null for a recipe whose lines name no food (#679). A line is in the pantry by
 * `pantryIngredientFor`'s rule: a line of alternatives by any of its foods,
 * any other line by all. A line with a reading is covered by its reading's foods.
 */
export function pantryCoverageSql(
  householdId: string,
  readings: LineReadings = {}
): SQL<number | null> {
  const covered = sql`(with recursive ${coveredCte(householdId)} select ingredient_id from covered)`;
  const stored = sql`CASE WHEN ${recipeIngredients.joined} = 'alternatives'
        THEN bool_or(${ingredientAliases.ingredientId} IN ${covered})
        ELSE bool_and(${ingredientAliases.ingredientId} IN ${covered})
      END`;
  const read = Object.keys(readings).length > 0 ? readCovered(readings, covered) : undefined;
  const lines = qb
    .select({
      lineCovered: (read
        ? sql<boolean>`CASE WHEN ${read.read} THEN ${read.covered} ELSE ${stored} END`
        : sql<boolean>`${stored}`
      ).as("line_covered"),
    })
    .from(recipeIngredients)
    .innerJoin(
      recipeIngredientFoods,
      eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
    )
    .innerJoin(ingredientAliases, eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId))
    .where(eq(recipeIngredients.recipeId, recipes.id))
    .groupBy(recipeIngredients.id, recipeIngredients.joined)
    .as("recipe_lines");

  return sql<number | null>`${qb
    .select({ share: sql`avg(CASE WHEN ${lines.lineCovered} THEN 1 ELSE 0 END)::real` })
    .from(lines)}`;
}
