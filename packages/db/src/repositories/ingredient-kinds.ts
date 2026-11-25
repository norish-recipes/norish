import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, eq, exists, inArray, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { ingredientAliases, ingredients, recipeIngredientFoods } from "../schema";
import { uuidListSql } from "./raw-sql";

/** How deep a walk down Parent Ingredient goes; a cycle in the data ends here. */
const KIND_DEPTH_MAX = 32;

const child = alias(ingredients, "child");
const qb = new QueryBuilder();

/**
 * The recursive CTE `kinds(root, ingredient_id, depth)`: each Ingredient of `roots` (a list or
 * subquery of ids) and every Parent Ingredient descendant of it. Goes after `WITH RECURSIVE`.
 */
export function kindWalkSql(roots: SQL): SQL {
  return sql`kinds(root, ingredient_id, depth) as (
      select ${ingredients.id}, ${ingredients.id}, 0 from ${ingredients} where ${ingredients.id} in (${roots})
      union
      select kinds.root, ${child.id}, kinds.depth + 1 from kinds
      join ${ingredients} as ${child} on ${child.parentId} = kinds.ingredient_id
      where kinds.depth < ${sql.raw(String(KIND_DEPTH_MAX))}
    )`;
}

/** The Ingredients `ids` name and every Parent Ingredient descendant of them, as a subquery of ids. */
export function ingredientKindsSql(ids: readonly string[]): SQL {
  return sql`(with recursive ${kindWalkSql(uuidListSql(ids))} select ingredient_id from kinds)`;
}

/** Whether the recipe line `lineId` names an Ingredient of `ingredientKindsSql(ids)`. */
export function lineNamesKindSql(lineId: AnyPgColumn, ids: readonly string[]): SQL {
  return exists(
    qb
      .select({ line: recipeIngredientFoods.recipeIngredientId })
      .from(recipeIngredientFoods)
      .innerJoin(
        ingredientAliases,
        eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId)
      )
      .where(
        and(
          eq(recipeIngredientFoods.recipeIngredientId, lineId),
          inArray(ingredientAliases.ingredientId, ingredientKindsSql(ids))
        )
      )
  );
}
