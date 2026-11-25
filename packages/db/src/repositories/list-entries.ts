/** Tags, Cuisines and Categories as household lists (ADR-0043): a row is its household's (null for
 * the instance), unique on its fold there; a recipe carries its household's and the instance's. */
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { dbLogger } from "@norish/db/logger";
import {
  categories,
  cuisines,
  recipeCategories,
  recipeCuisines,
  recipes,
  recipeTags,
  tags,
} from "@norish/db/schema";
import { LIST_NAME_MAX } from "@norish/shared/contracts/zod/list-entry";
import { entryFold } from "@norish/shared/lib/fold-name";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

import type { MutationOutcome } from "./mutation-outcomes";
import { isConstraintViolation } from "./constraint-violation";
import { ForeignHouseholdReferenceError } from "./household-rows";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";

export type ListKind = "tag" | "cuisine" | "category";

export const LIST_KINDS = ["tag", "cuisine", "category"] as const satisfies readonly ListKind[];

const KINDS = {
  tag: {
    table: tags,
    link: recipeTags,
    entity: recipeTags.tagId,
    linkRow: (recipeId: string, tagId: string, order: number) => ({ recipeId, tagId, order }),
  },
  cuisine: {
    table: cuisines,
    link: recipeCuisines,
    entity: recipeCuisines.cuisineId,
    linkRow: (recipeId: string, cuisineId: string, order: number) => ({
      recipeId,
      cuisineId,
      order,
    }),
  },
  category: {
    table: categories,
    link: recipeCategories,
    entity: recipeCategories.categoryId,
    linkRow: (recipeId: string, categoryId: string, order: number) => ({
      recipeId,
      categoryId,
      order,
    }),
  },
} as const;

type ListTable = (typeof KINDS)[ListKind]["table"];

/** Builds fragments without a connection, for queries other repositories run. */
const qb = new QueryBuilder();

/** An entry as its list shows it. */
export interface ListEntryRow {
  id: string;
  name: string;
  /** An instance entry (`household_id` null): the built-in Categories and the administrator's Cuisines. */
  instance: boolean;
  version: number;
}

/** An entry with the count of the household's recipes carrying it. */
interface ListEntry extends ListEntryRow {
  recipeCount: number;
}

/** A household's list, or the instance's entries alone when `householdId` is null. */
export type ListScope = string | null;

/** A name as a list stores it (no HTML, trimmed) with its fold; null when nothing is left. */
export function entryName(name: string): { name: string; fold: string } | null {
  const cleaned = stripHtmlTags(name).trim();

  return cleaned ? { name: cleaned, fold: entryFold(cleaned) } : null;
}

/**
 * The rows of a scope, by their `household_id`: a household's own, or the instance's for null; with
 * `offered`, the instance's too, as a household's list offers them. The household may be a subquery.
 */
export function inScope(
  householdId: AnyPgColumn,
  scope: ListScope | SQL,
  { offered = false }: { offered?: boolean } = {}
): SQL {
  if (scope === null) return isNull(householdId);

  const own = eq(householdId, scope);

  return offered ? or(own, isNull(householdId))! : own;
}

/** The columns of an entry as its list shows it. */
const rowColumns = (table: ListTable) => ({
  id: table.id,
  name: table.name,
  instance: isNull(table.householdId).mapWith(Boolean),
  version: table.version,
});

/** A list's order: by name, then id. */
const byName = (table: ListTable) => [sql`lower(${table.name})`, table.id];

/** Instance entries before a household's own. */
const instanceFirst = (table: ListTable) => sql`${table.householdId} NULLS FIRST`;

/** The entry as its list shows it, without the other columns a query read. */
const asEntryRow = ({ id, name, instance, version }: ListEntryRow): ListEntryRow => ({
  id,
  name,
  instance,
  version,
});

/** A row 0092 could not fold exactly: keyed by " <id>", which no fold can be. */
const PENDING_FOLD_PREFIX = " ";

/** The rows of `kind` waiting for their fold, oldest first. */
export async function listPendingFoldEntries(kind: ListKind, tx: Db = db) {
  const { table } = KINDS[kind];

  return await tx
    .select({ id: table.id, name: table.name, householdId: table.householdId })
    .from(table)
    .where(like(table.nameFold, `${PENDING_FOLD_PREFIX}%`))
    .orderBy(table.createdAt, table.id);
}

/** The scope's entry folded as `fold`, other than `id`, with whether it is older than `id`. */
export async function findFoldedTwinTx(
  tx: DbTransaction,
  kind: ListKind,
  scope: ListScope,
  fold: string,
  id: string
) {
  const { table } = KINDS[kind];
  const self = alias(table, "self");
  const [row] = await tx
    .select({
      id: table.id,
      older: sql<boolean>`(${table.createdAt}, ${table.id}) < (${self.createdAt}, ${self.id})`,
    })
    .from(table)
    .innerJoin(self, eq(self.id, id))
    .where(and(ne(table.id, self.id), inScope(table.householdId, scope), eq(table.nameFold, fold)));

  return row;
}

/** Writes `fold` as the entry's key. */
export async function setEntryFoldTx(tx: DbTransaction, kind: ListKind, id: string, fold: string) {
  const { table } = KINDS[kind];

  await tx.update(table).set({ nameFold: fold }).where(eq(table.id, id));
}

/** The household's entries and the instance's, by name. */
export async function listEntryRows(
  kind: ListKind,
  householdId: string,
  connection: Db = db
): Promise<ListEntryRow[]> {
  const { table } = KINDS[kind];

  return await connection
    .select(rowColumns(table))
    .from(table)
    .where(inScope(table.householdId, householdId, { offered: true }))
    .orderBy(...byName(table));
}

/** {@link listEntryRows}' names. */
export async function listEntryNames(kind: ListKind, householdId: string): Promise<string[]> {
  return (await listEntryRows(kind, householdId)).map((entry) => entry.name);
}

/** {@link listEntryRows} with how many of the household's recipes carry each. */
export async function listEntries(kind: ListKind, householdId: string): Promise<ListEntry[]> {
  const { table, link, entity } = KINDS[kind];

  // A link joins only through a recipe of the household, so `count` sees just those.
  return await db
    .select({ ...rowColumns(table), recipeCount: count(recipes.id) })
    .from(table)
    .leftJoin(link, eq(entity, table.id))
    .leftJoin(recipes, and(eq(recipes.id, link.recipeId), eq(recipes.householdId, householdId)))
    .where(inScope(table.householdId, householdId, { offered: true }))
    .groupBy(table.id)
    .orderBy(...byName(table));
}

/** The household whose list a recipe's entries come from: the recipe's own. */
export async function recipeHouseholdId(recipeId: string, connection: Db = db) {
  const [row] = await connection
    .select({ householdId: recipes.householdId })
    .from(recipes)
    .where(eq(recipes.id, recipeId));

  return row?.householdId ?? null;
}

/** How often a find-or-create looks again for a row a concurrent merge or delete removed. */
const ATTACH_ATTEMPTS = 3;

/** The household's (or instance's) entries for `names`, keyed by fold, the missing ones under the
 * kind's bound created when `create`; held `FOR KEY SHARE`, so a merge or delete waits for the attach. */
export async function entriesByFoldTx(
  tx: DbTransaction,
  kind: ListKind,
  householdId: string,
  names: readonly string[],
  { create }: { create: boolean }
): Promise<Map<string, ListEntryRow>> {
  const { table } = KINDS[kind];
  const wanted = new Map<string, string>();

  for (const entry of names.flatMap((name) => entryName(name) ?? [])) {
    if (!wanted.has(entry.fold)) wanted.set(entry.fold, entry.name);
  }

  const found = new Map<string, ListEntryRow>();

  for (let attempt = 0; attempt < ATTACH_ATTEMPTS && found.size < wanted.size; attempt += 1) {
    const missing = [...wanted.keys()].filter((fold) => !found.has(fold));
    const rows = await tx
      .select({ ...rowColumns(table), nameFold: table.nameFold })
      .from(table)
      .where(
        and(
          inScope(table.householdId, householdId, { offered: true }),
          inArray(table.nameFold, missing)
        )
      )
      .orderBy(instanceFirst(table))
      .for("key share");

    // An instance entry wins over a household's own of the same fold.
    for (const row of rows) {
      if (!found.has(row.nameFold)) found.set(row.nameFold, asEntryRow(row));
    }

    const absent = missing.filter((fold) => !found.has(fold));

    if (!create) break;

    // A name over the bound attaches when the list has it, but is never created.
    for (const fold of absent) {
      if ((wanted.get(fold) ?? "").length <= LIST_NAME_MAX[kind]) continue;

      dbLogger.debug({ kind, name: wanted.get(fold) }, "Not creating a list entry over its bound");
      wanted.delete(fold);
    }

    const creatable = absent.flatMap((fold) => {
      const name = wanted.get(fold);

      return name === undefined ? [] : [{ householdId, name, nameFold: fold }];
    });

    if (creatable.length === 0) break;

    await tx.insert(table).values(creatable).onConflictDoNothing();
  }

  return found;
}

/** Whether a recipe write creates the entries its names lack (default) or attaches only the ones
 * the list has: the editors attach, since they create through `lists.add`. */
export interface EntryWriteOptions {
  createEntries?: boolean;
}

/** Replaces a recipe's entries with `names`, in order, from the recipe's household's list. */
export async function replaceRecipeEntriesByNameTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  names: readonly string[],
  { createEntries = true }: EntryWriteOptions = {}
): Promise<void> {
  const householdId = await recipeHouseholdId(recipeId, tx);

  if (!householdId) return;

  const entries = await entriesByFoldTx(tx, kind, householdId, names, { create: createEntries });
  const ids = names.flatMap((name) => entries.get(entryName(name)?.fold ?? "")?.id ?? []);

  await writeRecipeLinksTx(tx, kind, recipeId, ids);
}

/** Replaces a recipe's entries with `ids`, in order: each the recipe's household's, the instance's
 * or one it carries already, else ForeignHouseholdReferenceError. */
export async function replaceRecipeEntryIdsTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  ids: readonly string[]
): Promise<void> {
  const { table, link, entity } = KINDS[kind];
  const unique = [...new Set(ids)];

  if (unique.length > 0) {
    const recipeHousehold = tx
      .select({ householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    // At most one link per recipe and entry, so the join adds no rows; only the entries are held.
    const allowed = await tx
      .select({ id: table.id })
      .from(table)
      .leftJoin(link, and(eq(link.recipeId, recipeId), eq(entity, table.id)))
      .where(
        and(
          inArray(table.id, unique),
          or(
            inScope(table.householdId, sql`(${recipeHousehold})`, { offered: true }),
            isNotNull(link.recipeId)
          )
        )
      )
      .for("key share", { of: table });

    if (allowed.length !== unique.length) throw new ForeignHouseholdReferenceError();
  }

  await writeRecipeLinksTx(tx, kind, recipeId, unique);
}

/** Links `recipeId` to `ids` in order, the first at `from`, keeping a link already there. */
async function insertLinksTx(
  tx: DbTransaction,
  kind: ListKind,
  links: readonly { recipeId: string; id: string; order: number }[]
): Promise<void> {
  const { link, linkRow } = KINDS[kind];

  if (links.length === 0) return;

  await tx
    .insert(link)
    .values(links.map((row) => linkRow(row.recipeId, row.id, row.order)))
    .onConflictDoNothing();
}

/** The links of `recipeId` to `ids` in order, the first at `from`. */
const linksOf = (recipeId: string, ids: readonly string[], from = 0) =>
  ids.map((id, index) => ({ recipeId, id, order: from + index }));

async function writeRecipeLinksTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  ids: readonly string[]
): Promise<void> {
  const { link } = KINDS[kind];

  await tx.delete(link).where(eq(link.recipeId, recipeId));
  await insertLinksTx(tx, kind, linksOf(recipeId, [...new Set(ids)]));
}

/** A recipe's entry names, in order. */
export async function recipeEntryNames(
  kind: ListKind,
  recipeId: string,
  connection: Db = db
): Promise<string[]> {
  const { table, link, entity } = KINDS[kind];
  const rows = await connection
    .select({ name: table.name })
    .from(link)
    .innerJoin(table, eq(table.id, entity))
    .where(eq(link.recipeId, recipeId))
    .orderBy(link.order, table.name);

  return rows.map((row) => row.name);
}

/** Adds the entries of `names` a recipe lacks (by fold) after its own, from its household's list,
 * removing none; answers the names added and all the recipe's names after. */
export async function appendRecipeEntriesTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  names: readonly string[]
): Promise<{ added: string[]; all: string[] }> {
  const existing = await recipeEntryNames(kind, recipeId, tx);
  const has = new Set(existing.map(entryFold));
  const householdId = await recipeHouseholdId(recipeId, tx);
  const fresh = names.flatMap((name) => entryName(name) ?? []).filter((e) => !has.has(e.fold));

  if (!householdId || fresh.length === 0) return { added: [], all: existing };

  const entries = await entriesByFoldTx(
    tx,
    kind,
    householdId,
    fresh.map((entry) => entry.name),
    { create: true }
  );
  const added = [...new Set(fresh.map((entry) => entry.fold))].flatMap(
    (fold) => entries.get(fold) ?? []
  );

  await insertLinksTx(
    tx,
    kind,
    linksOf(
      recipeId,
      added.map((entry) => entry.id),
      existing.length
    )
  );

  return {
    added: added.map((entry) => entry.name),
    all: [...existing, ...added.map((e) => e.name)],
  };
}

type AddEntryResult = { entry: ListEntryRow; created: boolean };

/** The scope's entry folded as `fold`, else the instance's; locked for a change when `lock`. */
async function foldedEntry(
  connection: Db,
  kind: ListKind,
  scope: ListScope,
  fold: string,
  lock = false
): Promise<ListEntryRow | undefined> {
  const { table } = KINDS[kind];
  const query = connection
    .select(rowColumns(table))
    .from(table)
    .where(and(inScope(table.householdId, scope, { offered: true }), eq(table.nameFold, fold)))
    .orderBy(instanceFirst(table))
    .limit(1)
    .$dynamic();
  const [row] = await (lock ? query.for("update") : query);

  return row;
}

/** Adds `name` to the scope's list. A name it has, the instance's included, answers that entry,
 * also when a concurrent add made it. */
export async function addEntry(
  kind: ListKind,
  scope: ListScope,
  name: string
): Promise<AddEntryResult | null> {
  const { table } = KINDS[kind];
  const entry = entryName(name);

  if (!entry) return null;

  const created = await db.transaction(async (tx) => {
    const [instance] = await tx
      .select({ id: table.id })
      .from(table)
      .where(and(isNull(table.householdId), eq(table.nameFold, entry.fold)));

    if (instance) return undefined;

    const [row] = await tx
      .insert(table)
      .values({ householdId: scope, name: entry.name, nameFold: entry.fold })
      .onConflictDoNothing()
      .returning(rowColumns(table));

    return row;
  });

  if (created) return { entry: created, created: true };

  const existing = await foldedEntry(db, kind, scope, entry.fold);

  return existing ? { entry: existing, created: false } : null;
}

/** Moves every recipe from `sourceId` onto `targetId` without duplicates, removes the source and
 * answers the target, its version bumped. */
export async function mergeEntryTx(
  tx: DbTransaction,
  kind: ListKind,
  sourceId: string,
  targetId: string
): Promise<ListEntryRow | undefined> {
  const { table, link, entity } = KINDS[kind];
  // The callers hold the source FOR UPDATE, so no attach adds a link between these statements.
  const moved = await tx
    .select({ recipeId: link.recipeId, order: link.order })
    .from(link)
    .where(eq(entity, sourceId));

  await insertLinksTx(
    tx,
    kind,
    moved.map((row) => ({ recipeId: row.recipeId, id: targetId, order: row.order }))
  );
  await tx.delete(link).where(eq(entity, sourceId));
  await tx.delete(table).where(eq(table.id, sourceId));

  const [target] = await tx
    .update(table)
    .set({ version: sql`${table.version} + 1` })
    .where(eq(table.id, targetId))
    .returning(rowColumns(table));

  return target;
}

/** An entry as a change names it: the version the caller last read. */
type EntryRef = { id: string; version: number };

/** The scope's entry `id`, locked for the change. */
async function lockOwnEntryTx(tx: DbTransaction, kind: ListKind, scope: ListScope, id: string) {
  const { table } = KINDS[kind];
  const [row] = await tx
    .select({ ...rowColumns(table), nameFold: table.nameFold })
    .from(table)
    .where(and(eq(table.id, id), inScope(table.householdId, scope)))
    .for("update");

  return row;
}

type RenameEntryResult = { entry: ListEntryRow; merged: boolean };

/** Renames the scope's entry, stale when changed since `version`; a name the list has (the
 * instance's included) merges the entry onto that one. */
export async function renameEntry(
  kind: ListKind,
  scope: ListScope,
  { id, version }: EntryRef,
  name: string
): Promise<MutationOutcome<RenameEntryResult> | null> {
  const { table } = KINDS[kind];
  const entry = entryName(name);

  if (!entry) return null;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const own = await lockOwnEntryTx(tx, kind, scope, id);

        if (!own) return null;
        if (own.version !== version) return staleOutcome<RenameEntryResult>();

        if (own.nameFold !== entry.fold) {
          const target = await foldedEntry(tx, kind, scope, entry.fold, true);

          if (target) {
            const merged = await mergeEntryTx(tx, kind, id, target.id);

            return merged ? appliedOutcome({ entry: merged, merged: true }) : null;
          }
        }

        const [renamed] = await tx
          .update(table)
          .set({ name: entry.name, nameFold: entry.fold, version: sql`${table.version} + 1` })
          .where(eq(table.id, id))
          .returning(rowColumns(table));

        return renamed ? appliedOutcome({ entry: renamed, merged: false }) : null;
      });
    } catch (error) {
      // An entry of that name made meanwhile: the next attempt merges onto it.
      if (attempt > 0 || !isConstraintViolation(error, "23505")) throw error;
    }
  }
}

/** Merges the scope's `source` into `target` (its own or an instance entry), stale when either
 * changed since its version: the source's recipes carry the target, and the source goes. */
export async function mergeEntries(
  kind: ListKind,
  scope: ListScope,
  source: EntryRef,
  target: EntryRef
): Promise<MutationOutcome<ListEntryRow> | null> {
  const { table } = KINDS[kind];

  if (source.id === target.id) return null;

  return await db.transaction(async (tx) => {
    // Both rows locked in id order, so two merges of the same pair cannot deadlock.
    const locked = await tx
      .select({
        ...rowColumns(table),
        owned: inScope(table.householdId, scope).mapWith(Boolean),
      })
      .from(table)
      .where(
        and(
          inArray(table.id, [source.id, target.id]),
          inScope(table.householdId, scope, { offered: true })
        )
      )
      .orderBy(table.id)
      .for("update");
    const from = locked.find((row) => row.id === source.id && row.owned);
    const into = locked.find((row) => row.id === target.id);

    if (!from || !into) return null;
    if (from.version !== source.version || into.version !== target.version) {
      return staleOutcome<ListEntryRow>();
    }

    const merged = await mergeEntryTx(tx, kind, source.id, target.id);

    return merged ? appliedOutcome(merged) : null;
  });
}

/** Deletes the scope's entry off every recipe, or stale when it changed since `version`; answers
 * how many recipes it came off. */
export async function deleteEntry(
  kind: ListKind,
  scope: ListScope,
  { id, version }: EntryRef
): Promise<MutationOutcome<{ detached: number }> | null> {
  const { table, link, entity } = KINDS[kind];

  return await db.transaction(async (tx) => {
    const own = await lockOwnEntryTx(tx, kind, scope, id);

    if (!own) return null;
    if (own.version !== version) return staleOutcome<{ detached: number }>();

    const detached = await tx
      .delete(link)
      .where(eq(entity, id))
      .returning({ recipeId: link.recipeId });

    await tx.delete(table).where(eq(table.id, id));

    return appliedOutcome({ detached: detached.length });
  });
}

/** The scope's entry `id`, or null when it is no entry of the scope. */
export async function findOwnEntry(
  kind: ListKind,
  scope: ListScope,
  id: string
): Promise<ListEntryRow | null> {
  const { table } = KINDS[kind];
  const [row] = await db
    .select(rowColumns(table))
    .from(table)
    .where(and(eq(table.id, id), inScope(table.householdId, scope)));

  return row ?? null;
}

/** Recipes carrying an entry whose fold is one of `names`', at least `required` of them. */
export function recipeCarriesFoldsSql(kind: ListKind, names: readonly string[], required = 1): SQL {
  const { table, link, entity } = KINDS[kind];
  const folds = [...new Set(names.map(entryFold))].filter(Boolean);

  if (folds.length === 0) return sql`false`;

  // The join qualifies the columns, so `recipes.id` binds to the outer query's recipe.
  const carried = qb
    .select({ folds: countDistinct(table.nameFold) })
    .from(link)
    .innerJoin(table, eq(table.id, entity))
    .where(and(eq(link.recipeId, recipes.id), inArray(table.nameFold, folds)));

  return sql`(${carried}) >= ${required}`;
}
