import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { DbTransaction } from "@norish/db/drizzle";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { ingredients, pantryIngredients } from "@norish/db/schema";
import { PantryIngredientSelectSchema } from "@norish/shared/contracts/zod";

/** The connection a caller is already inside, or the shared one. */
type Db = typeof db | DbTransaction;

const PantryIngredientsSchema = z.array(PantryIngredientSelectSchema);

function parsePantryIngredients(rows: unknown[]): PantryIngredientDto[] {
  const parsed = PantryIngredientsSchema.safeParse(rows);

  if (!parsed.success) throw new Error("Failed to parse pantry ingredients");

  return parsed.data;
}

/**
 * Every read of the Pantry: the row, plus the name of the Ingredient it
 * points at. A Pantry Ingredient holds no name of its own; whatever condition
 * follows is the reader's.
 */
function selectPantry(tx: Db = db) {
  return tx
    .select({
      id: pantryIngredients.id,
      userId: pantryIngredients.userId,
      ingredientId: pantryIngredients.ingredientId,
      version: pantryIngredients.version,
      name: ingredients.name,
    })
    .from(pantryIngredients)
    .innerJoin(ingredients, eq(ingredients.id, pantryIngredients.ingredientId));
}

/** The one Pantry Ingredient a condition names, or null where it names none. */
async function findOnePantryIngredient(
  where: SQL | undefined,
  tx: Db = db
): Promise<PantryIngredientDto | null> {
  const [row] = await selectPantry(tx).where(where).limit(1);

  if (!row) return null;

  return parsePantryIngredients([row])[0] ?? null;
}

/**
 * The Pantry as the household reads it: every member's items in one query,
 * ordered by name, the way the household's Stores are read across its user ids.
 */
export async function listPantryIngredientsByUserIds(
  userIds: string[]
): Promise<PantryIngredientDto[]> {
  if (userIds.length === 0) return [];

  const rows = await selectPantry()
    .where(inArray(pantryIngredients.userId, userIds))
    .orderBy(asc(sql`lower(${ingredients.name})`), asc(pantryIngredients.createdAt));

  return parsePantryIngredients(rows);
}

/**
 * The household's Pantry Ingredient of an Ingredient, if any member has one.
 * The household-wide rule that an Ingredient is in the Pantry once lives here
 * rather than in a constraint, because the rows span user ids, as Store names
 * do.
 */
export async function findPantryIngredientInHousehold(
  userIds: string[],
  ingredientId: string,
  tx: Db = db
): Promise<PantryIngredientDto | null> {
  if (userIds.length === 0) return null;

  return findOnePantryIngredient(
    and(
      inArray(pantryIngredients.userId, userIds),
      eq(pantryIngredients.ingredientId, ingredientId)
    ),
    tx
  );
}

/**
 * Put an Ingredient in the Pantry, or answer with the item the household
 * already has of it — `created` says which, and only a create is worth
 * announcing. The rule that an Ingredient is in a Pantry once lives here and
 * only here, and it holds under concurrency: the check and the write are one
 * transaction under an advisory lock on the Ingredient, so two members adding
 * spellings of one food at the same moment get one row between them, the
 * second waiting for the first and then finding what it wrote. Nothing else
 * takes that lock, and it goes with the transaction.
 *
 * The alias is what the ingredient resolver made of the text the member
 * typed, and the Ingredient is the alias's; nothing is minted here. The id is
 * the client's (ADR-0003).
 */
export async function addPantryIngredient(
  id: string,
  input: { userId: string; userIds: string[]; ingredientAliasId: string; ingredientId: string }
): Promise<{ item: PantryIngredientDto; created: boolean }> {
  return await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`pantry:${input.ingredientId}`}::text))`
    );

    const held = await findPantryIngredientInHousehold(input.userIds, input.ingredientId, tx);

    if (held) return { item: held, created: false };

    const [row] = await tx
      .insert(pantryIngredients)
      .values({
        id,
        userId: input.userId,
        ingredientId: input.ingredientId,
        ingredientAliasId: input.ingredientAliasId,
      })
      .returning({ id: pantryIngredients.id });

    if (!row) throw new Error("Failed to create pantry ingredient");

    const item = await findPantryIngredient(row.id, tx);

    if (!item) throw new Error("Failed to create pantry ingredient");

    return { item, created: true };
  });
}

/** One Pantry Ingredient with its name, however it was reached. */
export async function findPantryIngredient(
  id: string,
  tx: Db = db
): Promise<PantryIngredientDto | null> {
  return findOnePantryIngredient(eq(pantryIngredients.id, id), tx);
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
 * already gone is nothing to report. The Ingredient stays: it is not the
 * household's to delete.
 */
export async function deletePantryIngredient(id: string): Promise<boolean> {
  const deleted = await db
    .delete(pantryIngredients)
    .where(eq(pantryIngredients.id, id))
    .returning({ id: pantryIngredients.id });

  return deleted.length > 0;
}
