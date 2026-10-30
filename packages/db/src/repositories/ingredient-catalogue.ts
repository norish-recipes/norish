import type { SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import type { FlagReason } from "@norish/shared/contracts/ingredient-catalogue";
import type { IngredientSearch, IngredientSearchField } from "@norish/shared/lib/ingredient-search";
import { db } from "@norish/db/drizzle";
import {
  groceries,
  ingredientAliases,
  ingredientJunkPile,
  ingredients,
  pantryIngredients,
  recipeIngredientFoods,
  recipeIngredients,
  recipes,
  recurringGroceries,
} from "@norish/db/schema";
import { viewerAndHouseholdIds } from "@norish/shared/lib/household";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import type { RecipeListContext } from "./recipes";
import { buildOwnerPolicyCondition } from "./recipes";

/**
 * The catalogue as the Ingredients page reads it and edits within one Ingredient (ADR-0037); moves
 * between Ingredients are `ingredient-relocation`'s, the edit policy the caller's.
 */

/** One Ingredient as the page lists it, with every spelling it is known by. */
export interface CatalogueIngredient {
  id: string;
  name: string;
  flagged: boolean;
  flagReason: string | null;
  ownerId: string | null;
  version: number;
  parent: { id: string; name: string } | null;
  /** How many Ingredients are kinds of this one. */
  kinds: number;
  aliases: CatalogueAlias[];
}

export interface CatalogueAlias {
  id: string;
  text: string;
  ownerId: string | null;
  locale?: string | null;
  seeded?: boolean;
}

/** Who owns a row of the catalogue, which is what the edit policy is asked about. */
export interface CatalogueOwner {
  ownerId: string | null;
}

/**
 * One search over the fields it asks for (name, translations, parent): exact compares the fold,
 * contains runs `LIKE`; a name has no fold column, so it is matched lowercased.
 */
function matchingSearch(search: IngredientSearch, parents: { id: AnyPgColumn; name: AnyPgColumn }) {
  const matches = (value: SQL): SQL =>
    search.match === "exact"
      ? sql`${value} = ${search.fold}`
      : sql`${value} like ${search.pattern}`;
  const spellingOf = (ingredientId: SQL | typeof ingredients.id) =>
    sql`exists (select 1 from ${ingredientAliases} where ${ingredientAliases.ingredientId} = ${ingredientId} and ${matches(sql`${ingredientAliases.fold}`)})`;

  const byField: Record<IngredientSearchField, SQL> = {
    name: matches(sql`lower(${ingredients.name})`),
    translations: spellingOf(ingredients.id),
    parent: or(matches(sql`lower(${parents.name})`), spellingOf(sql`${parents.id}`)) ?? sql`false`,
  };

  return or(...search.fields.map((field) => byField[field]));
}

/**
 * A page of the catalogue (all, the flagged, or what a search finds by name or spelling): an exact
 * name first, then the flagged, then by name.
 */
export async function listCatalogueIngredients(query: {
  search: IngredientSearch | null;
  flaggedOnly: boolean;
  /** Only the Ingredients filed under this one (null: the ones filed under none); undefined for every one. */
  parentId?: string | null;
  /** Only the Ingredients filed under none that nothing is filed under: no parent, no kinds. */
  standaloneOnly?: boolean;
  /** Only this Ingredient, for a panel that follows one food a filter no longer lists. */
  id?: string;
  /** Only the foods the Ingredients page lists (`listedFood`), and only their kinds counted. */
  listedOnly?: boolean;
  limit: number;
  offset: number;
}): Promise<CatalogueIngredient[]> {
  const parents = alias(ingredients, "parent");
  const matchesSearch = query.search ? matchingSearch(query.search, parents) : undefined;
  const exactFirst = query.search
    ? [sql`case when lower(${ingredients.name}) = ${query.search.fold} then 0 else 1 end`]
    : [];
  const listedKind = query.listedOnly
    ? sql` and ${listedFood({ id: sql`k.id`, offId: sql`k.off_id` })}`
    : sql``;

  const rows = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      flagged: ingredients.flagged,
      flagReason: ingredients.flagReason,
      ownerId: ingredients.ownerId,
      version: ingredients.version,
      parentId: parents.id,
      parentName: parents.name,
      // The table under its own name again: a Drizzle alias in raw SQL renders bare.
      kinds: sql<number>`(select count(*)::int from ${ingredients} k where k.parent_id = ${ingredients.id}${listedKind})`,
    })
    .from(ingredients)
    .leftJoin(parents, eq(parents.id, ingredients.parentId))
    .where(
      and(
        query.id === undefined ? undefined : eq(ingredients.id, query.id),
        query.listedOnly ? ingredientIsListed() : undefined,
        query.flaggedOnly ? eq(ingredients.flagged, true) : undefined,
        query.parentId === undefined
          ? undefined
          : query.parentId === null
            ? isNull(ingredients.parentId)
            : eq(ingredients.parentId, query.parentId),
        query.standaloneOnly
          ? and(
              isNull(ingredients.parentId),
              sql`not exists (select 1 from ${ingredients} k where k.parent_id = ${ingredients.id}${listedKind})`
            )
          : undefined,
        matchesSearch
      )
    )
    .orderBy(
      ...exactFirst,
      desc(ingredients.flagged),
      asc(sql`lower(${ingredients.name})`),
      asc(ingredients.id)
    )
    .limit(query.limit)
    .offset(query.offset);

  if (rows.length === 0) return [];

  const aliases = await db
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      ownerId: ingredientAliases.ownerId,
      locale: ingredientAliases.locale,
      seeded: ingredientAliases.seeded,
      ingredientId: ingredientAliases.ingredientId,
    })
    .from(ingredientAliases)
    .where(
      inArray(
        ingredientAliases.ingredientId,
        rows.map((row) => row.id)
      )
    )
    .orderBy(asc(ingredientAliases.createdAt), asc(ingredientAliases.id));

  return rows.map(({ parentId, parentName, ...row }) => ({
    ...row,
    parent: parentId && parentName ? { id: parentId, name: parentName } : null,
    aliases: aliases
      .filter((alias) => alias.ingredientId === row.id)
      .map(({ ingredientId: _ingredientId, ...alias }) => alias),
  }));
}

/** Every spelling of one Ingredient, in every language, oldest first. */
export async function listCatalogueAliasesOf(ingredientId: string): Promise<CatalogueAlias[]> {
  return await db
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      ownerId: ingredientAliases.ownerId,
      locale: ingredientAliases.locale,
      seeded: ingredientAliases.seeded,
    })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.ingredientId, ingredientId))
    .orderBy(asc(ingredientAliases.createdAt), asc(ingredientAliases.id));
}

/** Whether a recipe line names the food with this id (`rowsNaming`). */
function namedByARecipeLine(food: SQL): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(recipeIngredientFoods)
      .where(rowsNaming(food).lineFoods)
  );
}

/**
 * Whether the Ingredients page lists a food: a seeded one always, an own one once a recipe line
 * names it. The others, grocery foods and own foods nothing names, are hidden and AI leaves them.
 */
function listedFood(food: { id: SQL; offId: SQL }): SQL {
  return sql`(${food.offId} is not null or ${namedByARecipeLine(food.id)})`;
}

/**
 * `listedFood` for the `ingredients` row the outer statement is on. Built per call, as
 * `ingredientIsNamed`.
 */
export function ingredientIsListed(): SQL {
  return listedFood({ id: sql`${ingredients}.id`, offId: sql`${ingredients}.off_id` });
}

/**
 * Whether AI may ask about a food: an own one a recipe line names that no person kept, named or
 * parented (ADR-0037). Built per call, as `ingredientIsNamed`: importing runs no query builder.
 */
function askableByAI(): SQL<boolean> {
  return sql<boolean>`(${and(
    isNull(ingredients.offId),
    eq(ingredients.keptDistinct, false),
    eq(ingredients.nameChosen, false),
    eq(ingredients.parentChosen, false),
    namedByARecipeLine(sql`${ingredients}.id`)
  )})`;
}

/** Whether AI may still ask about the food, read through the caller's transaction and lock. */
export async function isAskableByAI(tx: Db, id: string): Promise<boolean> {
  const [row] = await tx
    .select({ askable: askableByAI() })
    .from(ingredients)
    .where(eq(ingredients.id, id));

  return row?.askable ?? false;
}

/** Which of these foods are listed (seeded, or a recipe line names it), or only the seeded ones. */
export async function findIngredientIdsAmong(
  ids: readonly string[],
  which: "listed" | "seeded"
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      and(
        inArray(ingredients.id, [...new Set(ids)]),
        which === "seeded" ? isNotNull(ingredients.offId) : ingredientIsListed()
      )
    );

  return new Set(rows.map((row) => row.id));
}

/**
 * One Ingredient as an edit reads it: name, flag, owner, parent, whether its name is settled,
 * whether AI may ask about it and whether it is seeded.
 */
export async function findCatalogueIngredient(id: string): Promise<
  | (CatalogueOwner & {
      id: string;
      name: string;
      flagged: boolean;
      flagReason: string | null;
      parentId: string | null;
      nameSettled: boolean;
      askable: boolean;
      seeded: boolean;
    })
  | null
> {
  const [row] = await db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      flagged: ingredients.flagged,
      flagReason: ingredients.flagReason,
      ownerId: ingredients.ownerId,
      parentId: ingredients.parentId,
      nameSettled: ingredients.nameSettled,
      askable: askableByAI(),
      seeded: sql<boolean>`${ingredients.offId} is not null`,
    })
    .from(ingredients)
    .where(eq(ingredients.id, id))
    .limit(1);

  return row ?? null;
}

/** How many ids one lookup names: a query takes at most 65,535 parameters. */
const CHUNK = 1000;

/**
 * The names of these Ingredients, by id, any number at once, a thousand to
 * a query; an id the catalogue no longer holds is left out.
 */
export async function findCatalogueIngredientNames(
  ids: readonly string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids));
  const names = new Map<string, string>();

  for (let start = 0; start < unique.length; start += CHUNK) {
    const rows = await db
      .select({ id: ingredients.id, name: ingredients.name })
      .from(ingredients)
      .where(inArray(ingredients.id, unique.slice(start, start + CHUNK)));

    for (const row of rows) names.set(row.id, row.name);
  }

  return names;
}

/** Every food AI may ask about: what a Clean up over recipe foods asks about. */
export async function listAskableIngredientIds(): Promise<string[]> {
  const rows = await db.select({ id: ingredients.id }).from(ingredients).where(askableByAI());

  return rows.map((row) => row.id);
}

/**
 * What a Clean up over the whole catalogue asks about: every listed own food, and each seeded food
 * a person, an import or a merge added a spelling to, for that spelling's check alone.
 */
export async function listWholeCatalogueCleanUpIds(): Promise<string[]> {
  const added = db
    .select({ one: sql`1` })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.ingredientId, sql`${ingredients}.id`),
        eq(ingredientAliases.seeded, false)
      )
    );
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      or(
        and(isNull(ingredients.offId), ingredientIsListed()),
        and(isNotNull(ingredients.offId), exists(added))
      )
    );

  return rows.map((row) => row.id);
}

/** Every listed food, seeded ones included: what Fill gaps fills. */
export async function listListedIngredientIds(): Promise<string[]> {
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(ingredientIsListed());

  return rows.map((row) => row.id);
}

/** Lift the flag of every hidden food: no one sees it there and AI never asks. Answers how many. */
export async function unflagHiddenFoods(tx: Db = db): Promise<number> {
  const unflagged = await tx
    .update(ingredients)
    .set({ flagged: false, flagReason: null, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.flagged, true), sql`not ${ingredientIsListed()}`))
    .returning({ id: ingredients.id });

  return unflagged.length;
}

/** Forget which own foods' parents a person chose, so AI may ask about them. Answers how many. */
export async function unmarkChosenParents(tx: Db): Promise<number> {
  const unmarked = await tx
    .update(ingredients)
    .set({ parentChosen: false, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.parentChosen, true), isNull(ingredients.offId)))
    .returning({ id: ingredients.id });

  return unmarked.length;
}

/** Say anew why a Flagged Ingredient is one: AI was asked again and is still not sure. */
export async function setIngredientFlagReason(id: string, flagReason: FlagReason): Promise<void> {
  await db
    .update(ingredients)
    .set({ flagReason, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.id, id), eq(ingredients.flagged, true)));
}

export async function findCatalogueIngredientOwner(
  tx: DbTransaction,
  id: string
): Promise<CatalogueOwner | null> {
  const [row] = await tx
    .select({ ownerId: ingredients.ownerId })
    .from(ingredients)
    .where(eq(ingredients.id, id))
    .limit(1);

  return row ?? null;
}

export async function findCatalogueAliasOwner(
  tx: DbTransaction,
  aliasId: string
): Promise<(CatalogueOwner & { ingredientId: string; text: string; fold: string }) | null> {
  const [row] = await tx
    .select({
      ownerId: ingredientAliases.ownerId,
      ingredientId: ingredientAliases.ingredientId,
      text: ingredientAliases.text,
      fold: ingredientAliases.fold,
    })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.id, aliasId))
    .limit(1);

  return row ?? null;
}

/**
 * Rename an Ingredient and clear its flag; null where it is gone. A name another Ingredient holds,
 * even by a racing rename, throws a unique violation.
 */
export async function renameCatalogueIngredient(
  tx: DbTransaction,
  id: string,
  name: string
): Promise<{ id: string } | null> {
  const [row] = await tx
    .update(ingredients)
    .set({
      name,
      flagged: false,
      flagReason: null,
      nameSettled: true,
      nameChosen: true,
      version: sql`${ingredients.version} + 1`,
    })
    .where(eq(ingredients.id, id))
    .returning({ id: ingredients.id });

  return row ?? null;
}

/**
 * Mark an Ingredient a food of its own: its flag goes and the decision is kept, so Norish never
 * merges it later. Null where it is gone.
 */
export async function keepIngredientDistinct(
  tx: DbTransaction,
  id: string
): Promise<{ id: string } | null> {
  const [row] = await tx
    .update(ingredients)
    .set({
      flagged: false,
      flagReason: null,
      keptDistinct: true,
      version: sql`${ingredients.version} + 1`,
    })
    .where(eq(ingredients.id, id))
    .returning({ id: ingredients.id });

  return row ?? null;
}

/** The Ingredient a spelling already names, if any. */
export async function findIngredientIdByFold(
  tx: DbTransaction,
  fold: string
): Promise<string | null> {
  const [row] = await tx
    .select({ ingredientId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.fold, fold))
    .limit(1);

  return row?.ingredientId ?? null;
}

/**
 * Give an Ingredient a person's spelling; null where the unique fold refuses it, and the caller
 * says which food holds it.
 */
export async function insertCatalogueAlias(
  tx: DbTransaction,
  input: { ingredientId: string; text: string; fold: string; ownerId: string }
): Promise<CatalogueAlias | null> {
  const [row] = await tx.insert(ingredientAliases).values(input).onConflictDoNothing().returning({
    id: ingredientAliases.id,
    text: ingredientAliases.text,
    ownerId: ingredientAliases.ownerId,
  });

  return row ?? null;
}

/**
 * Remove a spelling; its rows move to the food's spelling folded as its name, else its oldest. The
 * caller holds the Ingredient and has kept it another spelling.
 */
export async function deleteCatalogueAlias(tx: DbTransaction, aliasId: string): Promise<void> {
  const [food] = await tx
    .select({ id: ingredients.id, name: ingredients.name })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(eq(ingredientAliases.id, aliasId));

  if (!food) return;

  const [heir] = await tx
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(and(eq(ingredientAliases.ingredientId, food.id), ne(ingredientAliases.id, aliasId)))
    .orderBy(
      desc(sql`${ingredientAliases.fold} = ${ingredientAliasFold(food.name)}`),
      asc(ingredientAliases.createdAt),
      asc(ingredientAliases.id)
    )
    .limit(1);

  if (!heir) throw new Error(`Spelling ${aliasId} is its food's last and cannot be removed`);

  for (const table of [recipeIngredientFoods, groceries, recurringGroceries, pantryIngredients]) {
    await tx
      .update(table)
      .set({ ingredientAliasId: heir.id })
      .where(eq(table.ingredientAliasId, aliasId));
  }
  await tx.delete(ingredientAliases).where(eq(ingredientAliases.id, aliasId));
}

/** Where an Ingredient is used, as one viewer may see it. */
export interface IngredientUses {
  /** The recipes the viewer may open with a line naming it. */
  recipes: Array<{ id: string; name: string }>;
  /** The household's groceries and recurring groceries naming it. */
  groceries: Array<{ id: string; name: string | null; done: boolean; recurring: boolean }>;
  /** Whether the household keeps it in the Pantry. */
  pantry: boolean;
  /** The uses the viewer may not see: other households' lists, recipes they cannot open. */
  elsewhere: number;
  /** Everything a delete touches, the viewer's or not; groceries include recurring ones. */
  counts: { recipeLines: number; groceries: number; pantry: number };
}

/**
 * What names a food, one condition per table: a line's food through its spelling, and a Grocery,
 * recurring grocery or Pantry Ingredient through its spelling or the food itself.
 */
export function rowsNaming(food: string | SQL) {
  const spellings = db
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(eq(ingredientAliases.ingredientId, food));
  const through = (
    table: typeof groceries | typeof recurringGroceries | typeof pantryIngredients
  ) => or(inArray(table.ingredientAliasId, spellings), eq(table.ingredientId, food));

  return {
    lineFoods: inArray(recipeIngredientFoods.ingredientAliasId, spellings),
    groceries: through(groceries),
    recurringGroceries: through(recurringGroceries),
    pantry: through(pantryIngredients),
  };
}

/** The Groceries and recurring groceries each condition picks, with their spelling, text and owner. */
export async function findGroceryRows(
  tx: Db,
  where: { groceries: SQL | undefined; recurring: SQL | undefined }
) {
  const read = (table: typeof groceries | typeof recurringGroceries, picked: SQL | undefined) =>
    tx
      .select({
        id: table.id,
        aliasId: table.ingredientAliasId,
        name: table.name,
        ownerId: table.userId,
      })
      .from(table)
      .where(picked);

  return {
    groceries: await read(groceries, where.groceries),
    recurring: await read(recurringGroceries, where.recurring),
  };
}

/**
 * What names an Ingredient for a viewer: recipes under the view policy, their household's groceries
 * and Pantry, and how many uses are someone else's.
 */
export async function listIngredientUses(
  viewer: RecipeListContext,
  ingredientId: string
): Promise<IngredientUses> {
  const naming = rowsNaming(ingredientId);
  const household = (userId: AnyPgColumn) =>
    sql<boolean>`${inArray(userId, viewerAndHouseholdIds(viewer))}`;
  const openable = (await buildOwnerPolicyCondition(viewer, recipes.userId, "view")) ?? sql`true`;

  const [lines, groceryRows, recurringRows, pantryRows] = await Promise.all([
    db
      .select({ id: recipes.id, name: recipes.name, visible: sql<boolean>`${openable}` })
      .from(recipeIngredients)
      .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
      .where(
        inArray(
          recipeIngredients.id,
          db
            .select({ id: recipeIngredientFoods.recipeIngredientId })
            .from(recipeIngredientFoods)
            .where(naming.lineFoods)
        )
      )
      .orderBy(asc(sql`lower(${recipes.name})`)),
    db
      .select({
        id: groceries.id,
        name: groceries.name,
        done: groceries.isDone,
        visible: household(groceries.userId),
      })
      .from(groceries)
      // A repeating grocery's copy on the list is listed and counted once, as the repeat.
      .where(and(naming.groceries, isNull(groceries.recurringGroceryId)))
      .orderBy(asc(groceries.isDone), asc(sql`lower(${groceries.name})`)),
    db
      .select({
        id: recurringGroceries.id,
        name: recurringGroceries.name,
        visible: household(recurringGroceries.userId),
      })
      .from(recurringGroceries)
      .where(naming.recurringGroceries),
    db
      .select({ visible: household(pantryIngredients.userId) })
      .from(pantryIngredients)
      .where(naming.pantry),
  ]);
  // A recipe naming the food on several lines is listed once.
  const openRecipes = new Map(lines.filter((line) => line.visible).map((line) => [line.id, line]));

  return {
    recipes: [...openRecipes.values()].map(({ id, name }) => ({ id, name })),
    groceries: [
      ...groceryRows
        .filter((row) => row.visible)
        .map(({ id, name, done }) => ({ id, name, done, recurring: false })),
      ...recurringRows
        .filter((row) => row.visible)
        .map(({ id, name }) => ({ id, name, done: false, recurring: true })),
    ],
    pantry: pantryRows.some((row) => row.visible),
    elsewhere: [...lines, ...groceryRows, ...recurringRows, ...pantryRows].filter(
      (row) => !row.visible
    ).length,
    counts: {
      recipeLines: lines.length,
      groceries: groceryRows.length + recurringRows.length,
      pantry: pantryRows.length,
    },
  };
}

/**
 * Delete an Ingredient with its spellings and links; the foreign keys unlink its lines and
 * Groceries, delete its Pantry Ingredients and orphan its children. The caller holds the tree lock.
 */
export async function deleteCatalogueIngredient(tx: DbTransaction, id: string): Promise<void> {
  await tx.delete(ingredients).where(eq(ingredients.id, id));
}

/**
 * Whether anything names the `ingredients` row the outer statement is on, by `rowsNaming`. Built
 * per call, so importing this module runs no query builder.
 */
export function ingredientIsNamed(): SQL {
  const naming = rowsNaming(sql`${ingredients}.id`);
  const any = (table: PgTable, where: SQL | undefined) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(table)
        .where(where)
    );

  return sql`(${or(
    any(recipeIngredientFoods, naming.lineFoods),
    any(groceries, naming.groceries),
    any(recurringGroceries, naming.recurringGroceries),
    any(pantryIngredients, naming.pantry)
  )})`;
}

/**
 * Delete the own Ingredients nothing names and no one's parent among `ids` (whose rows moved to
 * other foods), and those whose every spelling is on the junk pile ("chopped"). Answers how many
 * went. The caller holds the tree lock.
 */
export async function deleteUnnamedOwnFoods(
  tx: DbTransaction,
  ids: readonly string[]
): Promise<number> {
  const notJunk = db
    .select({ one: sql`1` })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.ingredientId, sql`${ingredients}.id`),
        sql`${ingredientAliases.fold} not in (select ${ingredientJunkPile.fold} from ${ingredientJunkPile})`
      )
    );
  const deleted = await tx
    .delete(ingredients)
    .where(
      and(
        or(
          ids.length > 0 ? inArray(ingredients.id, [...new Set(ids)]) : undefined,
          sql`not exists (${notJunk})`
        ),
        isNull(ingredients.offId),
        sql`not ${ingredientIsNamed()}`,
        sql`not exists (select 1 from ${ingredients} c where c.parent_id = ${ingredients}.id)`
      )
    )
    .returning({ id: ingredients.id });

  return deleted.length;
}

/**
 * Clear the mark on own Ingredients named again, delete those unnamed 90 nights and no one's
 * parent, mark the rest and unflag hidden ones; seeded ones never. The caller holds the tree lock.
 */
export async function sweepUnusedCatalogueIngredients(tx: DbTransaction): Promise<string[]> {
  const own = isNull(ingredients.offId);

  await tx
    .update(ingredients)
    .set({ unusedSince: null })
    .where(and(own, isNotNull(ingredients.unusedSince), ingredientIsNamed()));

  // ponytail: a line saved this instant onto a food going now is unlinked; lock aliases if it bites.
  const deleted = await tx
    .delete(ingredients)
    .where(
      and(
        own,
        // Half a day's slack: night 90 deletes what night 0 marked, whichever started earlier.
        lte(ingredients.unusedSince, sql`now() - interval '89 days 12 hours'`),
        sql`not ${ingredientIsNamed()}`,
        // A parent waits for its children; its mark stands, so it goes the night after the last.
        sql`not exists (select 1 from ${ingredients} c where c.parent_id = ${ingredients}.id)`
      )
    )
    .returning({ id: ingredients.id });

  await tx
    .update(ingredients)
    .set({ unusedSince: sql`now()` })
    .where(and(own, isNull(ingredients.unusedSince), sql`not ${ingredientIsNamed()}`));
  // A food whose last recipe line went is hidden now.
  await unflagHiddenFoods(tx);

  return deleted.map((row) => row.id);
}

/** Whether no Ingredient but `ingredientId` goes by `name`, in any case. */
export function nameIsFree(ingredientId: string, name: string): SQL {
  return sql`not exists (select 1 from ${ingredients} o where o.id <> ${ingredientId} and lower(o.name) = lower(${name}))`;
}

/** Settle an Ingredient's name unless it is settled already; whether it was. */
export async function settleIngredientName(id: string): Promise<boolean> {
  const settled = await db
    .update(ingredients)
    .set({ nameSettled: true, version: sql`${ingredients.version} + 1` })
    .where(and(eq(ingredients.id, id), eq(ingredients.nameSettled, false)))
    .returning({ id: ingredients.id });

  return settled.length > 0;
}

/**
 * Rename an unsettled Ingredient (any, `evenSettled`) to its Plain Name, settled and added as a
 * spelling, unless another Ingredient took the name; the flag stays as it was. Whether it was renamed.
 */
export async function renameToPlainName(
  tx: DbTransaction,
  id: string,
  name: string,
  { evenSettled = false } = {}
) {
  const [row] = await tx
    .update(ingredients)
    .set({ name, nameSettled: true, version: sql`${ingredients.version} + 1` })
    .where(
      and(
        eq(ingredients.id, id),
        evenSettled ? undefined : eq(ingredients.nameSettled, false),
        nameIsFree(id, name)
      )
    )
    .returning({ id: ingredients.id });

  if (row) {
    await tx
      .insert(ingredientAliases)
      .values({ text: name, fold: ingredientAliasFold(name), ingredientId: id, ownerId: null })
      .onConflictDoNothing();
  }

  return row !== undefined;
}
