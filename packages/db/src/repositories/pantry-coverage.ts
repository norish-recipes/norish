import type { SQL, SQLWrapper } from "drizzle-orm";
import { eq, isNotNull, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { LineReadings } from "@norish/shared/lib/line-foods";
import { db } from "@norish/db/drizzle";

import {
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredients,
  recipes,
} from "../schema";
import { arrayParam } from "./array-params";
import { withLineFoods } from "./line-foods";

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

/** Whether the Pantry holds a line, over its foods' rows: an "or" line by any, any other by all. */
function holds(food: SQLWrapper, alternatives: SQLWrapper, covered: SQL): SQL<boolean> {
  return sql<boolean>`coalesce(CASE WHEN bool_or(${alternatives})
    THEN bool_or(${food} IN ${covered}) ELSE bool_and(${food} IN ${covered}) END, false)`;
}

/**
 * Whether the Pantry holds each line read through the reader's catalogue (ADR-0042), as one jsonb
 * object by line id: worked out once a statement from one array per column, then looked up by key.
 */
function readHeld(readings: LineReadings, covered: SQL): SQL {
  const rows = Object.entries(readings).flatMap(([lineId, { foods, joined }]) =>
    (foods.length > 0 ? foods.map((food) => food.ingredientId) : [null]).map((ingredientId) => ({
      lineId,
      ingredientId,
      alternatives: joined === "alternatives",
    }))
  );
  const column = <T>(name: string) => sql<T>`${sql.identifier(name)}`.as(name);
  const lineIds = arrayParam(
    rows.map((row) => row.lineId),
    "uuid"
  );
  const foodIds = arrayParam(
    rows.map((row) => row.ingredientId),
    "uuid"
  );
  const alternatives = arrayParam(
    rows.map((row) => row.alternatives),
    "boolean"
  );
  // A subquery's field is read by its bare name, so these are named apart from the lines' columns.
  const read = qb
    .select({
      lineId: column<string>("read_line_id"),
      ingredientId: column<string | null>("read_ingredient_id"),
      alternatives: column<boolean>("read_alternatives"),
    })
    .from(
      sql`unnest(${lineIds}, ${foodIds}, ${alternatives}) as read(read_line_id, read_ingredient_id, read_alternatives)`
    )
    .as("read_food");
  const lines = qb
    .select({
      lineId: read.lineId,
      held: holds(read.ingredientId, read.alternatives, covered).as("read_held"),
    })
    .from(read)
    .groupBy(read.lineId)
    .as("read_lines");

  return sql`(${qb
    .select({ held: sql`coalesce(jsonb_object_agg(${lines.lineId}, ${lines.held}), '{}'::jsonb)` })
    .from(lines)})`;
}

/**
 * The share of a recipe's food lines in the household's Pantry, 0 to 1, or
 * null for a recipe whose lines name no food (#679). A line is in the pantry by
 * `pantryIngredientFor`'s rule: a line of alternatives by any of its foods,
 * any other line by all. A line with a reading is held by its reading's foods, none by none.
 */
export function pantryCoverageSql(
  householdId: string,
  readings: LineReadings = {}
): SQL<number | null> {
  const covered = sql`(with recursive ${coveredCte(householdId)} select ingredient_id from covered)`;
  const stored = holds(
    ingredientAliases.ingredientId,
    sql`${recipeIngredients.joined} = 'alternatives'`,
    covered
  );
  const read = sql`(${readHeld(readings, covered)} ->> ${recipeIngredients.id}::text)::boolean`;
  const lines = withLineFoods(
    db
      .select({ lineCovered: sql<boolean>`coalesce(${read}, ${stored})`.as("line_covered") })
      .from(recipeIngredients)
      .$dynamic()
  )
    .where(eq(recipeIngredients.recipeId, recipes.id))
    .groupBy(recipeIngredients.id)
    .as("recipe_lines");

  return sql<number | null>`${qb
    .select({ share: sql`avg(CASE WHEN ${lines.lineCovered} THEN 1 ELSE 0 END)::real` })
    .from(lines)}`;
}
