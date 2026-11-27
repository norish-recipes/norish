import type { SQL } from "drizzle-orm";
import { and, asc, eq, sql } from "drizzle-orm";

import type { RecipeNameCursor } from "@norish/shared/contracts/list-queries";
import { db } from "@norish/db/drizzle";
import { recipes } from "@norish/db/schema";

import type { ListKind } from "./list-entries";
import { entryLinkOf } from "./list-entries";
import { buildPolicyCondition } from "./recipes";

/** How many recipes one page of an entry's uses holds. */
export const ENTRY_RECIPES_PAGE = 50;

/** A page of recipes by name, and where the next one starts (null on the last). */
export interface RecipeNamePage {
  recipes: Array<{ id: string; name: string }>;
  nextCursor: RecipeNameCursor | null;
}

const loweredName = sql<string>`lower(${recipes.name})`;

/** What a page of recipes by name selects, with the key its cursor takes. */
export const recipeNameColumns = { id: recipes.id, name: recipes.name, key: loweredName };

/** By lowered name, the id breaking ties, so a page never skips or repeats one. */
export const byRecipeName = [asc(loweredName), asc(recipes.id)];

/** The recipes after `cursor` in {@link byRecipeName}'s order. */
export const afterRecipe = (cursor: RecipeNameCursor | null | undefined): SQL | undefined =>
  cursor ? sql`(${loweredName}, ${recipes.id}) > (${cursor.name}, ${cursor.id}::uuid)` : undefined;

/** `limit` of `rows` (read one more), and the cursor after the last when more follow. */
export function recipeNamePage(
  rows: ReadonlyArray<{ id: string; name: string; key: string }>,
  limit: number
): RecipeNamePage {
  const page = rows.slice(0, limit);
  const last = page.at(-1);

  return {
    recipes: page.map(({ id, name }) => ({ id, name })),
    nextCursor: rows.length > limit && last ? { name: last.key, id: last.id } : null,
  };
}

/** One page of the household's recipes the reader may view that carry the entry, by name. */
export async function listRecipesCarryingEntry(
  kind: ListKind,
  id: string,
  householdId: string,
  { limit = ENTRY_RECIPES_PAGE, cursor }: { limit?: number; cursor?: RecipeNameCursor | null } = {}
): Promise<RecipeNamePage> {
  const { link, recipeId, entityId } = entryLinkOf(kind);
  const view = await buildPolicyCondition({ householdId }, recipes.householdId, "view");
  const rows = await db
    .select(recipeNameColumns)
    .from(link)
    .innerJoin(recipes, eq(recipes.id, recipeId))
    .where(and(eq(entityId, id), eq(recipes.householdId, householdId), view, afterRecipe(cursor)))
    .orderBy(...byRecipeName)
    .limit(limit + 1);

  return recipeNamePage(rows, limit);
}
