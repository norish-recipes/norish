import { eq, isNotNull, sql } from "drizzle-orm";

import type { DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { ingredients } from "@norish/db/schema";

/**
 * What Ingredient Icons read and write in the catalogue: the tree of
 * Parent Ingredients with each food's own icon and Open Food Facts id, and
 * the one column an own icon lives in. Which icon a food shows is chosen by
 * `@norish/shared-server/ingredients/icons`, not here.
 */

/** An Ingredient as the icon walk reads it. */
export interface IconNode {
  id: string;
  name: string;
  parentId: string | null;
  offId: string | null;
  /** The own icon's file name, or null. */
  icon: string | null;
  ownerId: string | null;
}

/** How deep the tree is ever walked: a guard, since the tree has no cycle to loop on. */
const MAX_DEPTH = 64;

/** These Ingredients and every ancestor of each, by id. */
export async function findIconLineage(ids: readonly string[]): Promise<Map<string, IconNode>> {
  const wanted = [...new Set(ids)];

  if (wanted.length === 0) return new Map();

  const result = await db.execute<{
    id: string;
    name: string;
    parent_id: string | null;
    off_id: string | null;
    icon: string | null;
    owner_id: string | null;
  }>(sql`
    with recursive lineage(id, depth) as (
      select i.id, 0 from ${ingredients} i
      where i.id = any(${sql.param(wanted)}::uuid[])
      union
      select p.id, lineage.depth + 1 from lineage
      join ${ingredients} c on c.id = lineage.id
      join ${ingredients} p on p.id = c.parent_id
      where lineage.depth < ${MAX_DEPTH}
    )
    select distinct i.id::text as id, i.name, i.parent_id::text as parent_id, i.off_id, i.icon, i.owner_id
    from lineage join ${ingredients} i on i.id = lineage.id`);

  return new Map(result.rows.map((row) => [row.id, toNode(row)]));
}

/** Every Ingredient as the icon walk reads it: what a Draw icons round's scopes are counted over. */
export async function listIconCatalogue(): Promise<Map<string, IconNode>> {
  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      parentId: ingredients.parentId,
      offId: ingredients.offId,
      icon: ingredients.icon,
      ownerId: ingredients.ownerId,
    })
    .from(ingredients);

  return new Map(rows.map((row) => [row.id, row]));
}

function toNode(row: {
  id: string;
  name: string;
  parent_id: string | null;
  off_id: string | null;
  icon: string | null;
  owner_id: string | null;
}): IconNode {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    offId: row.off_id,
    icon: row.icon,
    ownerId: row.owner_id,
  };
}

/** Set or clear an Ingredient's own icon. Whether the Ingredient is still there. */
export async function setIngredientIcon(
  tx: DbTransaction | typeof db,
  id: string,
  icon: string | null
): Promise<boolean> {
  const updated = await tx
    .update(ingredients)
    .set({ icon, version: sql`${ingredients.version} + 1` })
    .where(eq(ingredients.id, id))
    .returning({ id: ingredients.id });

  return updated.length > 0;
}

/** The file names every own icon points at: what the sweep keeps. */
export async function listIngredientIconFiles(): Promise<Set<string>> {
  const rows = await db
    .selectDistinct({ icon: ingredients.icon })
    .from(ingredients)
    .where(isNotNull(ingredients.icon));

  return new Set(rows.flatMap((row) => (row.icon ? [row.icon] : [])));
}
