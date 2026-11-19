import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * The Ingredients `ids` name and every Parent Ingredient descendant of them, as a subquery of
 * Ingredient ids. A cycle in the data ends at the depth cap.
 */
export function ingredientKindsSql(ids: readonly string[]): SQL {
  const roots = sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  );

  return sql`(with recursive kinds(ingredient_id, depth) as (
      select i.id, 0 from ingredients i where i.id in (${roots})
      union
      select child.id, k.depth + 1 from kinds k
      join ingredients child on child.parent_id = k.ingredient_id
      where k.depth < 32
    ) select ingredient_id from kinds)`;
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
