import { and, asc, eq } from "drizzle-orm";

import { db } from "@norish/db/drizzle";
import { recipes } from "@norish/db/schema";

import type { ListKind } from "./list-entries";
import { entryLinkOf } from "./list-entries";
import { buildPolicyCondition } from "./recipes";

/** The household's recipes the reader may view that carry the entry, by name. */
export async function listRecipesCarryingEntry(
  kind: ListKind,
  id: string,
  householdId: string
): Promise<Array<{ id: string; name: string }>> {
  const { link, recipeId, entityId } = entryLinkOf(kind);
  const view = await buildPolicyCondition({ householdId }, recipes.householdId, "view");

  return db
    .select({ id: recipes.id, name: recipes.name })
    .from(link)
    .innerJoin(recipes, eq(recipes.id, recipeId))
    .where(and(eq(entityId, id), eq(recipes.householdId, householdId), view))
    .orderBy(asc(recipes.name));
}
