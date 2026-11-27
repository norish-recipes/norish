import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, eq, exists, inArray, isNotNull, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { ingredientAliases, ingredients, recipeIngredientFoods } from "../schema";
import { uuidListSql } from "./raw-sql";

/** How deep a walk down Parent Ingredient goes; a cycle in the data ends here. */
const KIND_DEPTH_MAX = 32;

/** How deep a walk up Parent Ingredient goes: a guard, since the tree has no cycle to loop on. */
const LINEAGE_DEPTH_MAX = 64;

const child = alias(ingredients, "child");
const lineageChild = alias(ingredients, "lineage_child");
const lineageParent = alias(ingredients, "lineage_parent");
const ancestryParent = alias(ingredients, "ancestry_parent");
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

/**
 * The CTE `lineage(lineage_id)`: each Ingredient of `ids` and every ancestor of each, possibly
 * repeated. No recursive CTE in the builder, so the walk is SQL over the schema inside a `$with`.
 */
export function lineageCte(ids: readonly string[]) {
  return qb.$with("lineage", { lineageId: sql<string>`lineage_id`.as("lineage_id") }).as(
    sql`with recursive walk(id, depth) as (
      select ${ingredients.id}, 0 from ${ingredients} where ${ingredients.id} = any(${sql.param([...ids])}::uuid[])
      union
      select ${lineageParent.id}, walk.depth + 1 from walk
      join ${ingredients} as ${lineageChild} on ${lineageChild.id} = walk.id
      join ${ingredients} as ${lineageParent} on ${lineageParent.id} = ${lineageChild.parentId}
      where walk.depth < ${LINEAGE_DEPTH_MAX}
    )
    select id as lineage_id from walk`
  );
}

/**
 * The CTE `ancestry(start, ancestor, depth)`: every ancestor of each Ingredient `roots` picks, `depth`
 * steps up, below `maxDepth`. No recursive CTE in the builder, so the walk is SQL inside a `$with`.
 */
export function ancestryCte(roots: SQL, maxDepth: number) {
  return qb
    .$with("ancestry", {
      start: sql<string>`start`.as("start"),
      ancestor: sql<string>`ancestor`.as("ancestor"),
      depth: sql<number>`depth`.as("depth"),
    })
    .as(
      sql`with recursive up(start, ancestor, depth) as (
        select ${ingredients.id}, ${ingredients.parentId}, 1 from ${ingredients}
        where ${roots} and ${isNotNull(ingredients.parentId)}
        union all
        select up.start, ${ancestryParent.parentId}, up.depth + 1 from up
        join ${ingredients} as ${ancestryParent} on ${ancestryParent.id} = up.ancestor
        where ${isNotNull(ancestryParent.parentId)} and up.depth < ${maxDepth}
      )
      select start, ancestor, depth from up`
    );
}
