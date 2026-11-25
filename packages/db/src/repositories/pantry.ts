import type { SQL } from "drizzle-orm";
import { and, asc, desc, eq, notInArray, notLike, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";
import z from "zod";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type { PantryIngredientDto, PantrySuggestionDto } from "@norish/shared/contracts";
import { db, holdLock } from "@norish/db/drizzle";
import {
  ingredientAliases,
  ingredients,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
} from "@norish/db/schema";
import { PantryIngredientSelectSchema, PantrySuggestionSchema } from "@norish/shared/contracts/zod";

import { inCatalogue } from "./catalogue-scope";
import { householdRow } from "./household-rows";
import { findLocaleNames } from "./ingredient-aliases";
import { coveredCte } from "./pantry-coverage";

const qb = new QueryBuilder();
const walkStart = alias(ingredients, "walk_start");
const walkParent = alias(ingredients, "walk_parent");
const PantryIngredientsSchema = z.array(PantryIngredientSelectSchema);

/** One household's Pantry rows as read, with each Ingredient's spelling in every language. */
async function parsePantryIngredients(
  rows: Array<{ ingredientId: string; householdId: string }>,
  tx: Db = db
): Promise<PantryIngredientDto[]> {
  const [first] = rows;
  const localeNames = first
    ? await findLocaleNames(
        first.householdId,
        rows.map((row) => row.ingredientId),
        tx
      )
    : new Map();
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
      householdId: pantryIngredients.householdId,
      userId: pantryIngredients.userId,
      ingredientId: pantryIngredients.ingredientId,
      version: pantryIngredients.version,
      name: ingredients.name,
      ancestorIds: sql<string[]>`(
        with recursive up(ancestor, depth) as (
          select ${walkStart.parentId}, 1 from ${ingredients} as ${walkStart}
          where ${walkStart.id} = ${pantryIngredients.ingredientId}
            and ${walkStart.parentId} is not null
          union all
          select ${walkParent.parentId}, up.depth + 1 from up
          join ${ingredients} as ${walkParent} on ${walkParent.id} = up.ancestor
          where ${walkParent.parentId} is not null and up.depth < 32
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

/** The household's Pantry, ordered by name. */
export async function listPantryIngredientsByHousehold(
  householdId: string
): Promise<PantryIngredientDto[]> {
  const rows = await selectPantry()
    .where(eq(pantryIngredients.householdId, householdId))
    .orderBy(asc(sql`lower(${ingredients.name})`), asc(pantryIngredients.createdAt));

  return await parsePantryIngredients(rows);
}

/** The household's Pantry Ingredient of an Ingredient, if it has one. */
export async function findPantryIngredientInHousehold(
  householdId: string,
  ingredientId: string,
  tx: Db = db
): Promise<PantryIngredientDto | null> {
  return findOnePantryIngredient(
    and(
      eq(pantryIngredients.householdId, householdId),
      eq(pantryIngredients.ingredientId, ingredientId)
    ),
    tx
  );
}

/** Lock an Ingredient's Pantry rows until the transaction ends: another add or merge of it waits. */
export async function lockPantryFood(tx: DbTransaction, ingredientId: string): Promise<void> {
  await holdLock(tx, `pantry:${ingredientId}`);
}

/** A Pantry Ingredient put in, and whether it is new or the one the household already had. */
export interface PantryAdded {
  item: PantryIngredientDto;
  created: boolean;
}

/**
 * Put Ingredients in the Pantry, all or none; one the household has answers `created: false`.
 * Each Ingredient is locked (`lockPantryFood`) in one order, so concurrent adds wait, not deadlock.
 */
export async function addPantryIngredients(
  items: Array<{ id: string; ingredientAliasId: string | null; ingredientId: string }>,
  owner: { userId: string; householdId: string }
): Promise<PantryAdded[]> {
  return await db.transaction(async (tx) => {
    const foods = [...new Set(items.map((item) => item.ingredientId))];

    for (const ingredientId of foods.sort((a, b) => a.localeCompare(b))) {
      await lockPantryFood(tx, ingredientId);
    }

    const added: PantryAdded[] = [];

    for (const { id, ingredientAliasId, ingredientId } of items) {
      const held = await findPantryIngredientInHousehold(owner.householdId, ingredientId, tx);

      if (held) {
        added.push({ item: held, created: false });
        continue;
      }

      const [row] = await tx
        .insert(pantryIngredients)
        .values({
          id,
          householdId: owner.householdId,
          userId: owner.userId,
          ingredientId,
          ingredientAliasId,
        })
        .returning({ id: pantryIngredients.id });
      const item = row && (await findPantryIngredient(row.id, owner.householdId, tx));

      if (!item) throw new Error("Failed to create pantry ingredient");

      added.push({ item, created: true });
    }

    return added;
  });
}

/** One of the household's Pantry Ingredients with its name. */
async function findPantryIngredient(
  id: string,
  householdId: string,
  tx: Db = db
): Promise<PantryIngredientDto | null> {
  return findOnePantryIngredient(householdRow(pantryIngredients, householdId, id), tx);
}

/** The household a Pantry Ingredient belongs to, for the household guard. */
export async function getPantryIngredientHouseholdId(id: string): Promise<string | null> {
  const [row] = await db
    .select({ householdId: pantryIngredients.householdId })
    .from(pantryIngredients)
    .where(eq(pantryIngredients.id, id))
    .limit(1);

  return row?.householdId ?? null;
}

/**
 * Take a name out of the Pantry. No version guard: an item is never edited,
 * so the last word is simply whether it is there, and removing what is
 * already gone is nothing to report. The Ingredient stays: it is not the
 * household's to delete.
 */
export async function deletePantryIngredient(id: string, householdId: string): Promise<boolean> {
  const deleted = await db
    .delete(pantryIngredients)
    .where(householdRow(pantryIngredients, householdId, id))
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
  householdId: string,
  ingredientId: string
): Promise<{ ingredientId: string; ingredientAliasId: string | null } | null> {
  const ownSpelling = qb
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.ingredientId, ingredients.id),
        inCatalogue(ingredientAliases.householdId, householdId)
      )
    )
    .orderBy(
      desc(sql`lower(${ingredientAliases.text}) = lower(${ingredients.name})`),
      asc(ingredientAliases.createdAt)
    )
    .limit(1);
  const [row] = await db
    .select({ ingredientId: ingredients.id, ingredientAliasId: sql<string | null>`${ownSpelling}` })
    .from(ingredients)
    .where(
      and(eq(ingredients.id, ingredientId), inCatalogue(ingredients.householdId, householdId))
    );

  return row ?? null;
}

/** How many foods "From your recipes" offers at most. */
const SUGGESTION_LIMIT = 36;

const PantrySuggestionsSchema = z.array(PantrySuggestionSchema);

/**
 * The foods the household's own recipes use most, for an empty Pantry to
 * start from: each food named by the lines of the household's recipes,
 * ranked by how many of those recipes name it, a recipe counting once per
 * food. Lines that name no food (a heading, a link to another recipe) never
 * count, and a food the Pantry covers (the same Ingredient, or a kept kind
 * of it) is left out.
 */
export async function listPantrySuggestions(householdId: string): Promise<PantrySuggestionDto[]> {
  // No recursive CTE in the builder: the Pantry's walk is SQL over the schema inside a `$with`.
  const covered = db
    .$with("covered_foods", { coveredId: sql<string>`covered_id`.as("covered_id") })
    .as(
      sql`with recursive ${coveredCte(householdId)} select ingredient_id as covered_id from covered`
    );
  const used = db.$with("used").as(
    db
      .select({
        ingredientId: ingredientAliases.ingredientId,
        recipeCount: sql<number>`count(distinct ${recipes.id})::int`.as("recipe_count"),
      })
      .from(recipes)
      .innerJoin(recipeIngredients, eq(recipeIngredients.recipeId, recipes.id))
      .innerJoin(
        recipeIngredientFoods,
        eq(recipeIngredientFoods.recipeIngredientId, recipeIngredients.id)
      )
      .innerJoin(
        ingredientAliases,
        eq(ingredientAliases.id, recipeIngredientFoods.ingredientAliasId)
      )
      .where(
        and(
          eq(recipes.householdId, householdId),
          notLike(sql`ltrim(${recipeIngredients.name})`, "#%"),
          sql`position('(id:' in ${recipeIngredients.name}) = 0`
        )
      )
      .groupBy(ingredientAliases.ingredientId)
  );
  const rows = await db
    .with(covered, used)
    .select({ ingredientId: ingredients.id, name: ingredients.name, recipeCount: used.recipeCount })
    .from(used)
    .innerJoin(ingredients, eq(ingredients.id, used.ingredientId))
    .where(notInArray(used.ingredientId, db.select({ id: covered.coveredId }).from(covered)))
    .orderBy(desc(used.recipeCount), asc(sql`lower(${ingredients.name})`))
    .limit(SUGGESTION_LIMIT);
  const localeNames = await findLocaleNames(
    householdId,
    rows.map((row) => row.ingredientId)
  );
  const parsed = PantrySuggestionsSchema.safeParse(
    rows.map((row) => ({ ...row, localeNames: localeNames.get(row.ingredientId) ?? {} }))
  );

  if (!parsed.success) throw new Error("Failed to parse pantry suggestions");

  return parsed.data;
}
