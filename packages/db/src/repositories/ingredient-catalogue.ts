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
  not,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

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
import { escapeLike } from "@norish/shared/lib/ingredient-search";
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { inCatalogue, ownBeforeSeed } from "./household-scope";

const qb = new QueryBuilder();
const kind = alias(ingredients, "k");
const otherFood = alias(ingredients, "o");

/** `column` qualified by its table, also where a single-table select would render it bare. */
const qualified = (column: AnyPgColumn) => sql`${column.table}.${sql.identifier(column.name)}`;

/** Whether no Ingredient has the `ingredients` row the outer statement is on as its parent. */
export const hasNoKinds = () =>
  notExists(qb.select({ id: kind.id }).from(kind).where(eq(kind.parentId, ingredients.id)));

/**
 * The catalogue as the Ingredients page reads it and edits within one Ingredient (ADR-0037); moves
 * between Ingredients are `ingredient-relocation`'s, the rights the caller's. Every read is one
 * household's catalogue: the seed plus its own rows (ADR-0042).
 */

/** One Ingredient as the page lists it, with every spelling the household knows it by. */
export interface CatalogueIngredient {
  id: string;
  name: string;
  flagged: boolean;
  flagReason: string | null;
  householdId: string | null;
  version: number;
  parent: { id: string; name: string } | null;
  /** How many Ingredients are kinds of this one. */
  kinds: number;
  aliases: CatalogueAlias[];
}

export interface CatalogueAlias {
  id: string;
  text: string;
  householdId: string | null;
  locale?: string | null;
  seeded?: boolean;
}

/** Whose a row of the catalogue is: a household's, or the seed's (null), which is what rights ask. */
export interface CatalogueOwner {
  householdId: string | null;
}

/** The non-ASCII marks `foldName` drops (`\p{Diacritic}`), as regex class ranges Postgres reads. */
const DIACRITICS = (() => {
  const marked = (code: number) => /\p{Diacritic}/u.test(String.fromCodePoint(code));
  let ranges = "";

  for (let code = 0x80; code <= 0x10000; code++) {
    if (marked(code) && !marked(code - 1)) ranges += String.fromCodePoint(code);
    if (!marked(code) && marked(code - 1)) ranges += `-${String.fromCodePoint(code - 1)}`;
  }

  return `[${ranges}]`;
})();

/** `foldName` in SQL, for a name with no fold column: marks dropped, recomposed, lowercased, every
 * other run one space. `forWords`: an ASCII name only lowercased, as a typed word holds no punctuation. */
export function folded(value: AnyPgColumn, forWords = false): SQL {
  const words = (text: SQL) =>
    sql`btrim(regexp_replace(lower(${text}), '[^[:alnum:]]+', ' ', 'g'))`;
  const ascii = forWords ? sql`lower(${value})` : words(sql`${value}`);

  return sql`case when octet_length(${value}) = length(${value}) then ${ascii} else ${words(sql`normalize(regexp_replace(normalize(${value}, NFD), ${sql.raw(`'${DIACRITICS}'`)}, '', 'g'), NFC)`)} end`;
}

/** Whether a folded text holds `word` as written (`start`: at the start of one of its words). */
export function holds(text: SQL, word: string, start = false): SQL {
  const escaped = escapeLike(word);

  return start
    ? sql`(${text} like ${`${escaped}%`} or ${text} like ${`% ${escaped}%`})`
    : sql`${text} like ${`%${escaped}%`}`;
}

/** The rank's folded name, joined laterally once a matched row (`offset 0` keeps Postgres from
 * inlining it into every use). */
const SEARCHED = sql.identifier("searched");
const SEARCHED_NAME = sql.identifier("name");
const searchedName = {
  join: sql`(select ${folded(ingredients.name)} as ${SEARCHED_NAME} offset 0) ${SEARCHED}`,
  fold: sql`${SEARCHED}.${SEARCHED_NAME}`,
};

/** A searched text (the name, its translations, the parent's) that is the fold exactly, or
 * (contains) holds every typed word, in any order; `start`: each word at the start of one of the
 * text's words. `parents` is only joined for a search of the `parent` field. */
export function matchingSearch(
  search: IngredientSearch,
  householdId: string,
  parents?: { id: AnyPgColumn; name: AnyPgColumn },
  start = false
) {
  const test = (text: SQL) =>
    search.match === "exact"
      ? sql`${text} = ${search.fold}`
      : (and(...search.words.map((word) => holds(text, word, start))) ?? sql`true`);
  // A name also by its lowercased phrase, as before folding: a C-locale database folds non-ASCII away.
  const name = (column: AnyPgColumn) =>
    or(
      test(folded(column, search.match === "contains")),
      search.match === "exact"
        ? sql`lower(${column}) = ${search.fold}`
        : holds(sql`lower(${column})`, search.fold, start)
    ) ?? sql`false`;
  const spellingOf = (ingredientId: AnyPgColumn) =>
    exists(
      qb
        .select({ id: ingredientAliases.id })
        .from(ingredientAliases)
        .where(
          and(
            eq(ingredientAliases.ingredientId, ingredientId),
            inCatalogue(ingredientAliases.householdId, householdId),
            test(sql`${ingredientAliases.fold}`)
          )
        )
    );

  const byField: Record<IngredientSearchField, SQL> = {
    name: name(ingredients.name),
    translations: spellingOf(ingredients.id),
    parent: parents ? (or(name(parents.name), spellingOf(parents.id)) ?? sql`false`) : sql`false`,
  };

  return or(...search.fields.map((field) => byField[field])) ?? sql`false`;
}

/** Whether a Tag or Category name starts a word with the typed `fold`: folded, or by its lowercase. */
export function nameStartsWith(column: AnyPgColumn, fold: string): SQL {
  return (
    or(holds(folded(column, true), fold, true), holds(sql`lower(${column})`, fold, true)) ??
    sql`false`
  );
}

/** The search's order over the name and the translations in the reader's `languages` (or none):
 * the exact fold, then a word starting with the first word typed; each translation set runs once. */
function searchRank(
  search: IngredientSearch,
  languages: readonly string[],
  householdId: string
): SQL {
  const exact = (text: SQL) => sql`${text} = ${search.fold}`;
  const wordStart = (text: SQL) => holds(text, search.words[0] ?? search.fold, true);
  const translated = (test: (text: SQL) => SQL) =>
    inArray(
      ingredients.id,
      qb
        .select({ id: ingredientAliases.ingredientId })
        .from(ingredientAliases)
        .where(
          and(
            inCatalogue(ingredientAliases.householdId, householdId),
            or(isNull(ingredientAliases.locale), inArray(ingredientAliases.locale, [...languages])),
            test(sql`${ingredientAliases.fold}`)
          )
        )
    );

  return sql`least(case when ${exact(searchedName.fold)} then 0 when ${wordStart(searchedName.fold)} then 1 else 2 end, case when ${translated(exact)} then 0 when ${translated(wordStart)} then 1 else 2 end)`;
}

/** A page of the catalogue (all, the flagged, or what a search finds by name or spelling): the
 * search's ranks first, then the flagged, then by name. */
export async function listCatalogueIngredients(query: {
  /** The reader's household: the page lists the seed and its own foods. */
  householdId: string;
  search: IngredientSearch | null;
  /** The reader's catalogue languages, whose translations rank a search (every one still matches). */
  languages: readonly string[];
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
  const matchesSearch = query.search
    ? matchingSearch(query.search, query.householdId, parents)
    : undefined;
  const ranks = query.search ? [searchRank(query.search, query.languages, query.householdId)] : [];
  const listedKind = query.listedOnly
    ? listedFood({
        id: qualified(kind.id),
        offId: qualified(kind.offId),
        addedByHand: qualified(kind.addedByHand),
      })
    : undefined;
  const kindsOf = (fields: { n: SQL }) =>
    qb
      .select(fields)
      .from(kind)
      .where(
        and(
          eq(kind.parentId, ingredients.id),
          inCatalogue(kind.householdId, query.householdId),
          listedKind
        )
      );

  const page = db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      flagged: ingredients.flagged,
      flagReason: ingredients.flagReason,
      householdId: ingredients.householdId,
      version: ingredients.version,
      parentId: parents.id,
      parentName: parents.name,
      kinds: sql<number>`${kindsOf({ n: sql`count(*)::int` })}`,
    })
    .from(ingredients)
    .leftJoin(parents, eq(parents.id, ingredients.parentId))
    .$dynamic();
  const rows = await (query.search ? page.crossJoinLateral(searchedName.join) : page)
    .where(
      and(
        inCatalogue(ingredients.householdId, query.householdId),
        query.id === undefined ? undefined : eq(ingredients.id, query.id),
        query.listedOnly ? ingredientIsListed() : undefined,
        query.flaggedOnly ? eq(ingredients.flagged, true) : undefined,
        query.parentId === undefined
          ? undefined
          : query.parentId === null
            ? isNull(ingredients.parentId)
            : eq(ingredients.parentId, query.parentId),
        query.standaloneOnly
          ? and(isNull(ingredients.parentId), notExists(kindsOf({ n: sql`1` })))
          : undefined,
        matchesSearch
      )
    )
    .orderBy(
      ...ranks,
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
      householdId: ingredientAliases.householdId,
      locale: ingredientAliases.locale,
      seeded: ingredientAliases.seeded,
      ingredientId: ingredientAliases.ingredientId,
    })
    .from(ingredientAliases)
    .where(
      and(
        inArray(
          ingredientAliases.ingredientId,
          rows.map((row) => row.id)
        ),
        inCatalogue(ingredientAliases.householdId, query.householdId)
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

/** Every spelling the household knows one of its or a seeded Ingredient by, oldest first. */
export async function listCatalogueAliasesOf(
  householdId: string,
  ingredientId: string
): Promise<CatalogueAlias[]> {
  return await db
    .select({
      id: ingredientAliases.id,
      text: ingredientAliases.text,
      householdId: ingredientAliases.householdId,
      locale: ingredientAliases.locale,
      seeded: ingredientAliases.seeded,
    })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(
      and(
        eq(ingredientAliases.ingredientId, ingredientId),
        inCatalogue(ingredients.householdId, householdId),
        inCatalogue(ingredientAliases.householdId, householdId)
      )
    )
    .orderBy(asc(ingredientAliases.createdAt), asc(ingredientAliases.id));
}

/** Whether a recipe line names this food; a join, as `rowsNaming`'s correlated IN can plan as
 * every food against every line (over 30 s on 1,500 recipes). */
function namedByARecipeLine(food: SQL): SQL {
  return exists(
    db
      .select({ one: sql`1` })
      .from(ingredientAliases)
      .innerJoin(
        recipeIngredientFoods,
        eq(recipeIngredientFoods.ingredientAliasId, ingredientAliases.id)
      )
      .where(eq(ingredientAliases.ingredientId, food))
  );
}

/**
 * Whether the Ingredients page lists a food: a seeded one or one added by hand always, an own one
 * once a recipe line names it. The others, grocery foods and own foods nothing names, are hidden and
 * AI leaves them.
 */
function listedFood(food: { id: SQL; offId: SQL; addedByHand: SQL }): SQL {
  return or(isNotNull(food.offId), food.addedByHand, namedByARecipeLine(food.id))!;
}

/**
 * `listedFood` for the `ingredients` row the outer statement is on. Built per call, as
 * `ingredientIsNamed`.
 */
export function ingredientIsListed(): SQL {
  return listedFood({
    id: qualified(ingredients.id),
    offId: qualified(ingredients.offId),
    addedByHand: qualified(ingredients.addedByHand),
  });
}

/**
 * Whether AI may ask about a food: an own one a recipe line names that no person added, kept, named
 * or parented (ADR-0037). Built per call, as `ingredientIsNamed`: importing runs no query builder.
 */
function askableByAI(): SQL<boolean> {
  return and(
    isNotNull(ingredients.householdId),
    eq(ingredients.addedByHand, false),
    eq(ingredients.keptDistinct, false),
    eq(ingredients.nameChosen, false),
    eq(ingredients.parentChosen, false),
    namedByARecipeLine(qualified(ingredients.id))
  )!.mapWith(Boolean);
}

/** Whether AI may still ask about the food, read through the caller's transaction and lock. */
export async function isAskableByAI(tx: Db, id: string): Promise<boolean> {
  const [row] = await tx
    .select({ askable: askableByAI() })
    .from(ingredients)
    .where(eq(ingredients.id, id));

  return row?.askable ?? false;
}

/** Which of these foods in the household's catalogue are listed (seeded, or a recipe line names it), or seeded. */
export async function findIngredientIdsAmong(
  householdId: string,
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
        inCatalogue(ingredients.householdId, householdId),
        which === "seeded" ? isNull(ingredients.householdId) : ingredientIsListed()
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
      ownerId: string | null;
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
      householdId: ingredients.householdId,
      ownerId: ingredients.ownerId,
      parentId: ingredients.parentId,
      nameSettled: ingredients.nameSettled,
      askable: askableByAI(),
      seeded: isNotNull(ingredients.offId).mapWith(Boolean),
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

/** Every food of the household AI may ask about: what a Clean up over recipe foods asks about. */
export async function listAskableIngredientIds(householdId: string): Promise<string[]> {
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(eq(ingredients.householdId, householdId), askableByAI()));

  return rows.map((row) => row.id);
}

/**
 * What a Clean up over the household's whole catalogue asks about: every listed own food no person
 * added by hand, and each seeded food the household added a spelling to, for that spelling alone.
 */
export async function listWholeCatalogueCleanUpIds(householdId: string): Promise<string[]> {
  const added = db
    .select({ one: sql`1` })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.ingredientId, ingredients.id),
        eq(ingredientAliases.householdId, householdId)
      )
    );
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      or(
        and(
          eq(ingredients.householdId, householdId),
          eq(ingredients.addedByHand, false),
          ingredientIsListed()
        ),
        and(isNull(ingredients.householdId), exists(added))
      )
    );

  return rows.map((row) => row.id);
}

/** The household's listed own foods, or the seed's foods (null): what Fill gaps fills. */
export async function listListedIngredientIds(householdId: string | null): Promise<string[]> {
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(
      householdId === null
        ? isNull(ingredients.householdId)
        : and(eq(ingredients.householdId, householdId), ingredientIsListed())
    );

  return rows.map((row) => row.id);
}

/** Which of these foods, in any household, are listed: for the jobs that keep the catalogue. */
export async function findListedIngredientIds(ids: readonly string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(and(inArray(ingredients.id, [...new Set(ids)]), ingredientIsListed()));

  return new Set(rows.map((row) => row.id));
}

/** The household each of these foods is in (null: the seed); a gone one is left out. */
export async function findIngredientHouseholds(
  ids: readonly string[],
  tx: Db = db
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const rows = await tx
    .select({ id: ingredients.id, householdId: ingredients.householdId })
    .from(ingredients)
    .where(inArray(ingredients.id, [...new Set(ids)]));

  return new Map(rows.map((row) => [row.id, row.householdId]));
}

/** The households with a spelling of their own on a food: whose spellings a check of it reads. */
export async function listSpellingHouseholds(ingredientId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ householdId: ingredientAliases.householdId })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.ingredientId, ingredientId),
        isNotNull(ingredientAliases.householdId)
      )
    );

  return rows.flatMap((row) => (row.householdId ? [row.householdId] : []));
}

/** The seed's foods, then each household's listed own foods: what a run over every catalogue covers. */
export async function listListedFoodsOfEveryCatalogue(): Promise<string[]> {
  const listed = await listListedIngredientIds(null);

  for (const householdId of await listCatalogueHouseholds()) {
    listed.push(...(await listListedIngredientIds(householdId)));
  }

  return listed;
}

/**
 * Every household with a food or spelling of its own (on a seeded food too): what a run over the
 * catalogue loops over, each in its own.
 */
export async function listCatalogueHouseholds(): Promise<string[]> {
  const rows = await db
    .select({ householdId: ingredients.householdId })
    .from(ingredients)
    .where(isNotNull(ingredients.householdId))
    .union(
      db
        .select({ householdId: ingredientAliases.householdId })
        .from(ingredientAliases)
        .where(isNotNull(ingredientAliases.householdId))
    );

  return rows.flatMap((row) => (row.householdId ? [row.householdId] : []));
}

/** Lift the flag of the household's hidden foods: no one sees it there and AI never asks. How many. */
export async function unflagHiddenFoods(tx: Db, householdId: string): Promise<number> {
  const unflagged = await tx
    .update(ingredients)
    .set({ flagged: false, flagReason: null, version: sql`${ingredients.version} + 1` })
    .where(
      and(
        eq(ingredients.householdId, householdId),
        eq(ingredients.flagged, true),
        not(ingredientIsListed())
      )
    )
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

/** Whose a food in the household's catalogue is; null where it is gone or another household's. */
export async function findCatalogueIngredientOwner(
  tx: Db,
  householdId: string,
  id: string
): Promise<CatalogueOwner | null> {
  const [row] = await tx
    .select({ householdId: ingredients.householdId })
    .from(ingredients)
    .where(and(eq(ingredients.id, id), inCatalogue(ingredients.householdId, householdId)))
    .limit(1);

  return row ?? null;
}

/** Whose a spelling in the household's catalogue is, with its food; null where it is not there. */
export async function findCatalogueAliasOwner(
  tx: DbTransaction,
  householdId: string,
  aliasId: string
): Promise<
  | (CatalogueOwner & { ingredientId: string; text: string; fold: string; ownerId: string | null })
  | null
> {
  const [row] = await tx
    .select({
      householdId: ingredientAliases.householdId,
      ownerId: ingredientAliases.ownerId,
      ingredientId: ingredientAliases.ingredientId,
      text: ingredientAliases.text,
      fold: ingredientAliases.fold,
    })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.id, aliasId),
        inCatalogue(ingredientAliases.householdId, householdId)
      )
    )
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

/** The Ingredient a spelling already names in the household's catalogue, its own first. */
export async function findIngredientIdByFold(
  tx: DbTransaction,
  householdId: string,
  fold: string
): Promise<string | null> {
  const [row] = await tx
    .select({ ingredientId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(
      and(eq(ingredientAliases.fold, fold), inCatalogue(ingredientAliases.householdId, householdId))
    )
    .orderBy(ownBeforeSeed(ingredientAliases.householdId))
    .limit(1);

  return row?.ingredientId ?? null;
}

/**
 * Give a food a spelling no one asked for (its new name, its plain name) where the household's
 * catalogue (null: the seed's) knows no spelling of the fold, so it never shadows the seed's.
 */
export async function addSpellingUnlessKnown(
  tx: Db,
  input: {
    householdId: string | null;
    ingredientId: string;
    text: string;
    fold: string;
    ownerId: string | null;
  }
): Promise<void> {
  const [known] = await tx
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.fold, input.fold),
        inCatalogue(ingredientAliases.householdId, input.householdId)
      )
    )
    .limit(1);

  if (!known) await tx.insert(ingredientAliases).values(input).onConflictDoNothing();
}

/**
 * Give an Ingredient a person's spelling, the household's (null: the seed's); null where the unique
 * fold refuses it, and the caller says which food holds it.
 */
export async function insertCatalogueAlias(
  tx: DbTransaction,
  input: {
    householdId: string | null;
    ingredientId: string;
    text: string;
    fold: string;
    ownerId: string;
  }
): Promise<CatalogueAlias | null> {
  const [row] = await tx.insert(ingredientAliases).values(input).onConflictDoNothing().returning({
    id: ingredientAliases.id,
    text: ingredientAliases.text,
    householdId: ingredientAliases.householdId,
  });

  return row ?? null;
}

/** The spellings of a food the rows of a spelling of `householdId` (null: the seed's) may move to. */
export function spellingsSeenBy(householdId: string | null): SQL {
  return inCatalogue(ingredientAliases.householdId, householdId);
}

/**
 * Remove a spelling; its rows move to the food's spelling folded as its name, else its oldest, among
 * those its household sees. The caller holds the Ingredient and has kept it such a spelling.
 */
export async function deleteCatalogueAlias(tx: DbTransaction, aliasId: string): Promise<void> {
  const [food] = await tx
    .select({
      id: ingredients.id,
      name: ingredients.name,
      householdId: ingredientAliases.householdId,
    })
    .from(ingredientAliases)
    .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
    .where(eq(ingredientAliases.id, aliasId));

  if (!food) return;

  const [heir] = await tx
    .select({ id: ingredientAliases.id })
    .from(ingredientAliases)
    .where(
      and(
        eq(ingredientAliases.ingredientId, food.id),
        ne(ingredientAliases.id, aliasId),
        spellingsSeenBy(food.householdId)
      )
    )
    .orderBy(
      desc(eq(ingredientAliases.fold, ingredientAliasFold(food.name))),
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

/** Where an Ingredient is used in the viewer's household (ADR-0042). */
export interface IngredientUses {
  /** The household's recipes with a line naming it. */
  recipes: Array<{ id: string; name: string }>;
  /** The household's groceries and recurring groceries naming it. */
  groceries: Array<{ id: string; name: string | null; done: boolean; recurring: boolean }>;
  /** Whether the household keeps it in the Pantry. */
  pantry: boolean;
  /** How many of the household's rows name it; groceries include recurring ones. */
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

/** The Groceries and recurring groceries each condition picks, with their spelling, text and household. */
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
        householdId: table.householdId,
      })
      .from(table)
      .where(picked);

  return {
    groceries: await read(groceries, where.groceries),
    recurring: await read(recurringGroceries, where.recurring),
  };
}

/**
 * What of the viewer's household names an Ingredient of its catalogue: its recipes, groceries and
 * Pantry, nothing of another household's. Null where the food is not in the catalogue.
 */
export async function listIngredientUses(
  householdId: string,
  ingredientId: string
): Promise<IngredientUses | null> {
  if (!(await findCatalogueIngredientOwner(db, householdId, ingredientId))) return null;
  const naming = rowsNaming(ingredientId);

  const [lines, groceryRows, recurringRows, pantryRows] = await Promise.all([
    db
      .select({ id: recipes.id, name: recipes.name })
      .from(recipeIngredients)
      .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
      .where(
        and(
          eq(recipes.householdId, householdId),
          inArray(
            recipeIngredients.id,
            db
              .select({ id: recipeIngredientFoods.recipeIngredientId })
              .from(recipeIngredientFoods)
              .where(naming.lineFoods)
          )
        )
      )
      .orderBy(asc(sql`lower(${recipes.name})`)),
    db
      .select({ id: groceries.id, name: groceries.name, done: groceries.isDone })
      .from(groceries)
      // A repeating grocery's copy on the list is listed and counted once, as the repeat.
      .where(
        and(
          eq(groceries.householdId, householdId),
          naming.groceries,
          isNull(groceries.recurringGroceryId)
        )
      )
      .orderBy(asc(groceries.isDone), asc(sql`lower(${groceries.name})`)),
    db
      .select({ id: recurringGroceries.id, name: recurringGroceries.name })
      .from(recurringGroceries)
      .where(and(eq(recurringGroceries.householdId, householdId), naming.recurringGroceries)),
    db
      .select({ id: pantryIngredients.id })
      .from(pantryIngredients)
      .where(and(eq(pantryIngredients.householdId, householdId), naming.pantry)),
  ]);
  // A recipe naming the food on several lines is listed once.
  const listed = new Map(lines.map((line) => [line.id, line]));

  return {
    recipes: [...listed.values()],
    groceries: [
      ...groceryRows.map(({ id, name, done }) => ({ id, name, done, recurring: false })),
      ...recurringRows.map(({ id, name }) => ({ id, name, done: false, recurring: true })),
    ],
    pantry: pantryRows.length > 0,
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
  const naming = rowsNaming(qualified(ingredients.id));
  const any = (table: PgTable, where: SQL | undefined) =>
    exists(
      db
        .select({ one: sql`1` })
        .from(table)
        .where(where)
    );

  return or(
    any(recipeIngredientFoods, naming.lineFoods),
    any(groceries, naming.groceries),
    any(recurringGroceries, naming.recurringGroceries),
    any(pantryIngredients, naming.pantry)
  )!;
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
        eq(ingredientAliases.ingredientId, ingredients.id),
        notExists(
          qb
            .select({ id: ingredientJunkPile.id })
            .from(ingredientJunkPile)
            .where(
              and(
                eq(ingredientJunkPile.fold, ingredientAliases.fold),
                inCatalogue(ingredientJunkPile.householdId, ingredients.householdId),
                ne(ingredientJunkPile.reason, "names-a-food")
              )
            )
        )
      )
    );
  const deleted = await tx
    .delete(ingredients)
    .where(
      and(
        or(
          ids.length > 0 ? inArray(ingredients.id, [...new Set(ids)]) : undefined,
          notExists(notJunk)
        ),
        isNull(ingredients.offId),
        eq(ingredients.addedByHand, false),
        not(ingredientIsNamed()),
        hasNoKinds()
      )
    )
    .returning({ id: ingredients.id });

  return deleted.length;
}

/**
 * In one household, clear the mark on own Ingredients named again, delete those unnamed 90 nights,
 * no one's parent and not added by hand, mark the rest and unflag hidden ones. The caller holds the
 * tree lock.
 */
export async function sweepUnusedCatalogueIngredients(
  tx: DbTransaction,
  householdId: string
): Promise<string[]> {
  const own = and(eq(ingredients.householdId, householdId), eq(ingredients.addedByHand, false));

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
        not(ingredientIsNamed()),
        // A parent waits for its children; its mark stands, so it goes the night after the last.
        hasNoKinds()
      )
    )
    .returning({ id: ingredients.id });

  await tx
    .update(ingredients)
    .set({ unusedSince: sql`now()` })
    .where(and(own, isNull(ingredients.unusedSince), not(ingredientIsNamed())));
  // A food whose last recipe line went is hidden now.
  await unflagHiddenFoods(tx, householdId);

  return deleted.map((row) => row.id);
}

/**
 * Whether no Ingredient but `ingredientId` goes by `name`, in any case, among the seed and the
 * household of the `ingredients` row the outer statement is on.
 */
export function nameIsFree(ingredientId: string, name: string): SQL {
  return notExists(
    qb
      .select({ id: otherFood.id })
      .from(otherFood)
      .where(
        and(
          ne(otherFood.id, ingredientId),
          eq(sql`lower(${otherFood.name})`, sql`lower(${name})`),
          inCatalogue(otherFood.householdId, ingredients.householdId)
        )
      )
  );
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
    .returning({ id: ingredients.id, householdId: ingredients.householdId });

  if (row) {
    await addSpellingUnlessKnown(tx, {
      householdId: row.householdId,
      text: name,
      fold: ingredientAliasFold(name),
      ingredientId: id,
      ownerId: null,
    });
  }

  return row !== undefined;
}
