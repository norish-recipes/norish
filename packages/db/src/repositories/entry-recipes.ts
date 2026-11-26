import { and, asc, eq } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { recipes } from "@norish/db/schema";

import type { ListKind } from "./list-entries";
import { entryLinkOf } from "./list-entries";
import { buildPolicyCondition } from "./recipes";

/** How many recipes one page of an entry's uses holds. */
export const ENTRY_RECIPES_PAGE = 50;

/**
 * One page of the household's recipes the reader may view that carry the entry, by name (the id
 * breaks ties, so pages never overlap); `hasMore` says whether another page follows.
 */
export async function listRecipesCarryingEntry(
  kind: ListKind,
  id: string,
  householdId: string,
  { limit = ENTRY_RECIPES_PAGE, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<{ recipes: Array<{ id: string; name: string }>; hasMore: boolean }> {
  const { link, recipeId, entityId } = entryLinkOf(kind);
  const view = await buildPolicyCondition({ householdId }, recipes.householdId, "view");
  const rows = await db
    .select({ id: recipes.id, name: recipes.name })
    .from(link)
    .innerJoin(recipes, eq(recipes.id, recipeId))
    .where(and(eq(entityId, id), eq(recipes.householdId, householdId), view))
    .orderBy(asc(recipes.name), asc(recipes.id))
    .limit(limit + 1)
    .offset(offset);

  return { recipes: rows.slice(0, limit), hasMore: rows.length > limit };
}
