import type { SQL } from "drizzle-orm";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import z from "zod";

import type { DbTransaction } from "@norish/db/drizzle";
import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";
import { db } from "@norish/db/drizzle";
import { ingredients, pantryIngredients } from "@norish/db/schema";
import { PantryIngredientSelectSchema, PantrySuggestionSchema } from "@norish/shared/contracts/zod";

import { findLocaleNames } from "./ingredient-aliases";

/** The connection a caller is already inside, or the shared one. */
type Db = typeof db | DbTransaction;

const PantryIngredientsSchema = z.array(PantryIngredientSelectSchema);

/** Pantry rows as read, with each Ingredient's spelling in every language. */
async function parsePantryIngredients(
  rows: Array<{ ingredientId: string }>,
  tx: Db = db
): Promise<PantryIngredientDto[]> {
  const localeNames = await findLocaleNames(
    rows.map((row) => row.ingredientId),
    tx
  );
  const parsed = PantryIngredientsSchema.safeParse(
    rows.map((row) => ({ ...row, localeNames: localeNames.get(row.ingredientId) ?? {} }))
  );

  if (!parsed.success) throw new Error("Failed to parse pantry ingredients");

  return parsed.data;
}

/**
 * Every read of the Pantry: the row, plus the name of the Ingredient it
 * points at and that Ingredient's ancestors. A Pantry Ingredient holds no name of its own; whatever condition
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
      ancestorIds: sql<string[]>`(
        with recursive up(ancestor, depth) as (
          select i.parent_id, 1 from ${ingredients} i
          where i.id = ${pantryIngredients.ingredientId} and i.parent_id is not null
          union all
          select p.parent_id, up.depth + 1 from up join ${ingredients} p on p.id = up.ancestor
          where p.parent_id is not null and up.depth < 32
        )
        select coalesce(array_agg(ancestor::text order by depth), '{}'::text[]) from up
      )`,
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

  return (await parsePantryIngredients([row], tx))[0] ?? null;
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

  return await parsePantryIngredients(rows);
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
  input: {
    userId: string;
    userIds: string[];
    ingredientAliasId: string | null;
    ingredientId: string;
  }
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

/**
 * A picked food as a Pantry Ingredient points at it: the Ingredient and its
 * own spelling, the alias written as its name, else its oldest. Null where
 * the Ingredient is gone; a null alias where it has no spelling at all, as
 * only a row from before the catalogue lacks.
 */
export async function findIngredientOwnSpelling(
  ingredientId: string
): Promise<{ ingredientId: string; ingredientAliasId: string | null } | null> {
  const rows = await db.execute<{ ingredient_id: string; alias_id: string | null }>(sql`
    select i.id as ingredient_id, (
      select a.id from ingredient_aliases a
      where a.ingredient_id = i.id
      order by (lower(a.text) = lower(i.name)) desc, a.created_at asc
      limit 1
    ) as alias_id
    from ingredients i
    where i.id = ${ingredientId}
  `);
  const row = rows.rows[0];

  return row ? { ingredientId: row.ingredient_id, ingredientAliasId: row.alias_id } : null;
}

/** How many foods "From your recipes" offers at most. */
const SUGGESTION_LIMIT = 36;

const PantrySuggestionsSchema = z.array(PantrySuggestionSchema);

/**
 * The foods the household's own recipes use most, for an empty Pantry to
 * start from: each food named by the lines of recipes its members own,
 * ranked by how many of those recipes name it, a recipe counting once per
 * food. Lines that name no food (a heading, a link to another recipe) never
 * count, and a food the Pantry covers (the same Ingredient, or a kept kind
 * of it) is left out.
 */
export async function listPantrySuggestions(userIds: string[]): Promise<PantrySuggestionDto[]> {
  if (userIds.length === 0) return [];

  const members = sql.join(
    userIds.map((id) => sql`${id}`),
    sql`, `
  );
  const rows = await db.execute<{ ingredient_id: string; name: string; recipe_count: number }>(sql`
    with recursive covered(ingredient_id, depth) as (
      select p.ingredient_id, 0 from pantry_ingredients p where p.user_id in (${members})
      union
      select i.parent_id, c.depth + 1 from covered c
      join ingredients i on i.id = c.ingredient_id
      where i.parent_id is not null and c.depth < 32
    ),
    used as (
      select a.ingredient_id, count(distinct r.id)::int as recipe_count
      from recipes r
      join recipe_ingredients ri on ri.recipe_id = r.id
      join ingredient_aliases a on a.id = ri.ingredient_alias_id
      where r.user_id in (${members})
        and ltrim(ri.name) not like '#%'
        and position('(id:' in ri.name) = 0
      group by a.ingredient_id
    )
    select i.id as ingredient_id, i.name, used.recipe_count
    from used
    join ingredients i on i.id = used.ingredient_id
    where used.ingredient_id not in (select ingredient_id from covered)
    order by used.recipe_count desc, lower(i.name) asc
    limit ${SUGGESTION_LIMIT}
  `);
  const localeNames = await findLocaleNames(rows.rows.map((row) => row.ingredient_id));
  const parsed = PantrySuggestionsSchema.safeParse(
    rows.rows.map((row) => ({
      ingredientId: row.ingredient_id,
      name: row.name,
      recipeCount: row.recipe_count,
      localeNames: localeNames.get(row.ingredient_id) ?? {},
    }))
  );

  if (!parsed.success) throw new Error("Failed to parse pantry suggestions");

  return parsed.data;
}
