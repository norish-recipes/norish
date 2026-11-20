import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { uuidListSql } from "./raw-sql";

/** How deep a walk down Parent Ingredient goes; a cycle in the data ends here. */
const KIND_DEPTH_MAX = 32;

/**
 * The recursive CTE `kinds(root, ingredient_id, depth)`: each Ingredient of `roots` (a list or
 * subquery of ids) and every Parent Ingredient descendant of it. Goes after `WITH RECURSIVE`.
 */
export function kindWalkSql(roots: SQL): SQL {
  return sql`kinds(root, ingredient_id, depth) as (
      select i.id, i.id, 0 from ingredients i where i.id in (${roots})
      union
      select k.root, child.id, k.depth + 1 from kinds k
      join ingredients child on child.parent_id = k.ingredient_id
      where k.depth < ${sql.raw(String(KIND_DEPTH_MAX))}
    )`;
}

/** The Ingredients `ids` name and every Parent Ingredient descendant of them, as a subquery of ids. */
export function ingredientKindsSql(ids: readonly string[]): SQL {
  return sql`(with recursive ${kindWalkSql(uuidListSql(ids))} select ingredient_id from kinds)`;
}

/** Whether a recipe line (`line`, a table alias) names an Ingredient of `ingredientKindsSql(ids)`. */
export function lineNamesKindSql(line: string, ids: readonly string[]): SQL {
  return sql`EXISTS (
    SELECT 1 FROM recipe_ingredient_foods ${sql.raw(`${line}_food`)}
    JOIN ingredient_aliases ${sql.raw(`${line}_alias`)}
      ON ${sql.raw(`${line}_alias`)}.id = ${sql.raw(`${line}_food`)}.ingredient_alias_id
    WHERE ${sql.raw(`${line}_food`)}.recipe_ingredient_id = ${sql.raw(line)}.id
      AND ${sql.raw(`${line}_alias`)}.ingredient_id IN ${ingredientKindsSql(ids)}
  )`;
}
