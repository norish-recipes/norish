import { and, asc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import {
  getOrCreateIngredientByName,
  setIngredientNormalizedNames,
} from "@norish/db/repositories/ingredients";
import { ingredients, pantryIngredients } from "@norish/db/schema";
import { PantryIngredientSelectSchema } from "@norish/shared/contracts/zod";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";

const PantryIngredientsSchema = z.array(PantryIngredientSelectSchema);

function parsePantryIngredients(rows: unknown[]): PantryIngredientDto[] {
  const parsed = PantryIngredientsSchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse pantry ingredients");

  return parsed.data;
}

/**
 * A Pantry Ingredient as the household reads it: the row, plus the name it points
 * at. A Pantry Ingredient holds no name of its own, so every read joins the
 * Ingredient Name — the same join a recipe line makes for its own name.
 * A fold is null only on a row written before names were folded, which the
 * startup backfill fills in; until then it matches nothing, which is what an
 * empty fold means everywhere else.
 */
function pantryColumns() {
  return {
    id: pantryIngredients.id,
    userId: pantryIngredients.userId,
    ingredientId: pantryIngredients.ingredientId,
    version: pantryIngredients.version,
    name: ingredients.name,
    normalizedName: sql<string>`coalesce(${ingredients.normalizedName}, '')`,
  };
}

/**
 * The Pantry as the household reads it: every member's items in one query,
 * by folded name, the way the household's Stores are read across its user ids.
 */
export async function listPantryIngredientsByUserIds(
  userIds: string[]
): Promise<PantryIngredientDto[]> {
  if (userIds.length === 0) return [];

  const rows = await db
    .select(pantryColumns())
    .from(pantryIngredients)
    .innerJoin(ingredients, eq(ingredients.id, pantryIngredients.ingredientId))
    .where(inArray(pantryIngredients.userId, userIds))
    .orderBy(asc(ingredients.normalizedName), asc(pantryIngredients.createdAt));

  return parsePantryIngredients(rows);
}

/**
 * The household's Pantry Ingredient for a folded name, if any member has one. The
 * household-wide rule that a name is in the Pantry once lives here rather
 * than in a constraint, because the rows span user ids, as Store names do.
 *
 * The fold is matched on the Ingredient Name, not on the Pantry row: two
 * names that fold alike are the same thing at home even where they are two
 * Ingredient Names, which is the rule ADR-0036 states.
 */
export async function findPantryIngredientInHousehold(
  userIds: string[],
  normalizedName: string
): Promise<PantryIngredientDto | null> {
  if (userIds.length === 0 || !normalizedName) return null;

  const [row] = await db
    .select(pantryColumns())
    .from(pantryIngredients)
    .innerJoin(ingredients, eq(ingredients.id, pantryIngredients.ingredientId))
    .where(
      and(
        inArray(pantryIngredients.userId, userIds),
        eq(ingredients.normalizedName, normalizedName)
      )
    )
    .limit(1);

  if (!row) return null;

  return parsePantryIngredients([row])[0] ?? null;
}

/**
 * Put a name in the Pantry. The name is the Ingredient Name it points at,
 * minted here where Norish has not seen it — the same get-or-create editing a
 * recipe makes, because a pantry name and a recipe line's name are one kind of
 * thing. The id is the client's (ADR-0003). A name that folds to nothing is
 * not an item and is refused, as is a name this member already has: the row
 * constraint holds one Ingredient Name per member, and the fold, which is the
 * looser rule, is held here.
 */
export async function createPantryIngredient(
  id: string,
  input: { userId: string; name: string }
): Promise<PantryIngredientDto> {
  const normalizedName = normalizeGroceryName(input.name);

  if (!normalizedName) throw new Error("A pantry ingredient needs a name");

  const held = await findPantryIngredientInHousehold([input.userId], normalizedName);

  if (held) throw new Error("The pantry already holds that name");

  const ingredient = await getOrCreateIngredientByName(input.name.trim());

  // A name minted before names were folded carries no fold, and a Pantry
  // Ingredient whose name has no fold matches nothing. Fold it as it is taken
  // into a Pantry rather than waiting for the next startup.
  if (ingredient.normalizedName === null) {
    await setIngredientNormalizedNames([
      { id: ingredient.id, normalizedName: normalizeGroceryName(ingredient.name) },
    ]);
  }

  const [row] = await db
    .insert(pantryIngredients)
    .values({ id, userId: input.userId, ingredientId: ingredient.id })
    .returning({ id: pantryIngredients.id });

  if (!row) throw new Error("Failed to create pantry ingredient");

  const item = await findPantryIngredient(row.id);

  if (!item) throw new Error("Failed to create pantry ingredient");

  return item;
}

/** One Pantry Ingredient with its name, however it was reached. */
export async function findPantryIngredient(id: string): Promise<PantryIngredientDto | null> {
  const [row] = await db
    .select(pantryColumns())
    .from(pantryIngredients)
    .innerJoin(ingredients, eq(ingredients.id, pantryIngredients.ingredientId))
    .where(eq(pantryIngredients.id, id))
    .limit(1);

  if (!row) return null;

  return parsePantryIngredients([row])[0] ?? null;
}

/** Whose Pantry Ingredient this is: the authorization primitive, as for a Store. */
export async function getPantryIngredientOwnerId(id: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: pantryIngredients.userId })
    .from(pantryIngredients)
    .where(eq(pantryIngredients.id, id))
    .limit(1);

  return row?.userId ?? null;
}

/**
 * Take a name out of the Pantry. No version guard: an item is never edited,
 * so the last word is simply whether it is there, and removing what is
 * already gone is nothing to report. The Ingredient Name stays: it is not the
 * household's to delete.
 */
export async function deletePantryIngredient(id: string): Promise<boolean> {
  const deleted = await db
    .delete(pantryIngredients)
    .where(eq(pantryIngredients.id, id))
    .returning({ id: pantryIngredients.id });

  return deleted.length > 0;
}
