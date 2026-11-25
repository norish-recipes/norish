/**
 * Tags, Cuisines and Categories as household lists (ADR-0043). A row carries its household, null
 * for an instance entry, and is unique on `entryFold(name)` within the household or the instance;
 * a recipe carries only its own household's entries and instance entries.
 */
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import {
  categories,
  cuisines,
  recipeCategories,
  recipeCuisines,
  recipes,
  recipeTags,
  tags,
} from "@norish/db/schema";
import { entryFold } from "@norish/shared/lib/fold-name";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

import { isConstraintViolation } from "./constraint-violation";
import { ForeignHouseholdReferenceError } from "./household-rows";
import { rowsOf, uuidListSql } from "./raw-sql";

export type ListKind = "tag" | "cuisine" | "category";

export const LIST_KINDS = ["tag", "cuisine", "category"] as const satisfies readonly ListKind[];

const KINDS = {
  tag: { table: tags, link: recipeTags, entity: sql.identifier("tag_id") },
  cuisine: { table: cuisines, link: recipeCuisines, entity: sql.identifier("cuisine_id") },
  category: { table: categories, link: recipeCategories, entity: sql.identifier("category_id") },
} as const;

/** An entry as its list shows it. */
export interface ListEntryRow {
  id: string;
  name: string;
  /** An instance entry (`household_id` null): the built-in Categories and the administrator's Cuisines. */
  instance: boolean;
  version: number;
}

/** An entry with the count of the household's recipes carrying it. */
export interface ListEntry extends ListEntryRow {
  recipeCount: number;
}

/** A household's list, or the instance's entries alone when `householdId` is null. */
export type ListScope = string | null;

/** A name as a list stores it: no HTML, trimmed; empty when nothing is left. */
export function cleanEntryName(name: string): string {
  return stripHtmlTags(name).trim();
}

/** Whether a row is the scope's own: the household's, or an instance entry for the null scope. */
function ownedBy(scope: ListScope, alias = sql.raw("e")): SQL {
  return scope === null
    ? sql`${alias}.household_id IS NULL`
    : sql`${alias}.household_id = ${scope}::uuid`;
}

/** The rows a household is offered: its own and the instance's. */
export function offeredTo(householdId: string, alias = sql.raw("e")): SQL {
  return sql`(${alias}.household_id = ${householdId}::uuid OR ${alias}.household_id IS NULL)`;
}

const ROW_COLUMNS = sql`e.id, e.name, (e.household_id IS NULL) AS instance, e.version`;

/** A row 0092 could not fold exactly: keyed by " <id>", which no fold can be. */
export const PENDING_FOLD_PREFIX = " ";

/** The rows of `kind` waiting for their fold, oldest first. */
export async function listPendingFoldEntries(kind: ListKind, tx: Db = db) {
  const { table } = KINDS[kind];

  return rowsOf<{ id: string; name: string; household_id: string | null }>(
    await tx.execute(sql`
      SELECT e.id, e.name, e.household_id FROM ${table} e
      WHERE starts_with(e.name_fold, ${PENDING_FOLD_PREFIX}) ORDER BY e.created_at, e.id
    `)
  );
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
  const [row] = rowsOf<{ id: string; older: boolean }>(
    await tx.execute(sql`
      SELECT e.id, (e.created_at, e.id) < (self.created_at, self.id) AS older
      FROM ${table} e, ${table} self
      WHERE self.id = ${id}::uuid AND e.id <> self.id AND ${ownedBy(scope)} AND e.name_fold = ${fold}
    `)
  );

  return row;
}

/** Writes `fold` as the entry's key. */
export async function setEntryFoldTx(tx: DbTransaction, kind: ListKind, id: string, fold: string) {
  const { table } = KINDS[kind];

  await tx.execute(sql`UPDATE ${table} SET name_fold = ${fold} WHERE id = ${id}::uuid`);
}

/** The household's entries and the instance's, by name. */
export async function listEntryRows(
  kind: ListKind,
  householdId: string,
  connection: Db = db
): Promise<ListEntryRow[]> {
  const { table } = KINDS[kind];
  const result = await connection.execute(sql`
    SELECT ${ROW_COLUMNS} FROM ${table} e WHERE ${offeredTo(householdId)}
    ORDER BY lower(e.name), e.id
  `);

  return rowsOf<ListEntryRow>(result);
}

/** {@link listEntryRows} with how many of the household's recipes carry each. */
export async function listEntries(kind: ListKind, householdId: string): Promise<ListEntry[]> {
  const { table, link, entity } = KINDS[kind];
  const result = await db.execute(sql`
    SELECT ${ROW_COLUMNS}, (
      SELECT count(*)::int FROM ${link} l JOIN ${recipes} r ON r.id = l.recipe_id
      WHERE l.${entity} = e.id AND r.household_id = ${householdId}::uuid
    ) AS "recipeCount"
    FROM ${table} e WHERE ${offeredTo(householdId)}
    ORDER BY lower(e.name), e.id
  `);

  return rowsOf<ListEntry>(result);
}

/** The household whose list a recipe's entries come from: the recipe's own. */
export async function recipeHouseholdId(recipeId: string, connection: Db = db) {
  const [row] = rowsOf<{ household_id: string }>(
    await connection.execute(sql`SELECT household_id FROM ${recipes} WHERE id = ${recipeId}::uuid`)
  );

  return row?.household_id ?? null;
}

/**
 * The household's entries (or the instance's) for `names`, by fold, creating the missing ones in
 * the household when `create`. Rows are held `FOR KEY SHARE` until the transaction ends, so a
 * merge or delete waits for the attach; a row it removed meanwhile is made again.
 */
export async function entriesForNamesTx(
  tx: DbTransaction,
  kind: ListKind,
  householdId: string,
  names: readonly string[],
  { create }: { create: boolean }
): Promise<Map<string, ListEntryRow>> {
  const { table } = KINDS[kind];
  const wanted = new Map<string, string>();

  for (const name of names.map(cleanEntryName)) {
    if (name && !wanted.has(entryFold(name))) wanted.set(entryFold(name), name);
  }

  const found = new Map<string, ListEntryRow>();

  for (let attempt = 0; attempt < 3 && found.size < wanted.size; attempt += 1) {
    const missing = [...wanted.keys()].filter((fold) => !found.has(fold));
    const rows = rowsOf<ListEntryRow & { name_fold: string }>(
      await tx.execute(sql`
        SELECT ${ROW_COLUMNS}, e.name_fold FROM ${table} e
        WHERE ${offeredTo(householdId)} AND e.name_fold IN (${sql.join(
          missing.map((fold) => sql`${fold}`),
          sql`, `
        )})
        ORDER BY e.household_id NULLS FIRST
        FOR KEY SHARE
      `)
    );

    // An instance entry wins over a household's own of the same fold.
    for (const row of rows) {
      if (!found.has(row.name_fold)) {
        found.set(row.name_fold, {
          id: row.id,
          name: row.name,
          instance: row.instance,
          version: row.version,
        });
      }
    }

    const absent = missing.filter((fold) => !found.has(fold));

    if (!create || absent.length === 0) break;

    await tx.execute(sql`
      INSERT INTO ${table} (household_id, name, name_fold) VALUES ${sql.join(
        absent.map((fold) => sql`(${householdId}::uuid, ${wanted.get(fold)}, ${fold})`),
        sql`, `
      )} ON CONFLICT DO NOTHING
    `);
  }

  return found;
}

/** Replaces a recipe's entries with `names`, in order, from the recipe's household's list. */
export async function replaceRecipeEntriesByNameTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  names: readonly string[]
): Promise<void> {
  const householdId = await recipeHouseholdId(recipeId, tx);

  if (!householdId) return;

  const entries = await entriesForNamesTx(tx, kind, householdId, names, { create: true });
  const ids = names.flatMap((name) => entries.get(entryFold(cleanEntryName(name)))?.id ?? []);

  await writeRecipeLinksTx(tx, kind, recipeId, ids);
}

/**
 * Replaces a recipe's entries with `ids`, in order. An id must be the recipe's household's, an
 * instance entry, or one the recipe already carries; any other is refused.
 */
export async function replaceRecipeEntryIdsTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  ids: readonly string[]
): Promise<void> {
  const { table, link, entity } = KINDS[kind];
  const unique = [...new Set(ids)];

  if (unique.length > 0) {
    const allowed = rowsOf<{ id: string }>(
      await tx.execute(sql`
        SELECT e.id FROM ${table} e
        WHERE e.id IN (${uuidListSql(unique)}) AND (
          e.household_id IS NULL
          OR e.household_id = (SELECT household_id FROM ${recipes} WHERE id = ${recipeId}::uuid)
          OR EXISTS (SELECT 1 FROM ${link} l WHERE l.recipe_id = ${recipeId}::uuid AND l.${entity} = e.id)
        )
        FOR KEY SHARE
      `)
    );

    if (allowed.length !== unique.length) throw new ForeignHouseholdReferenceError();
  }

  await writeRecipeLinksTx(tx, kind, recipeId, unique);
}

async function writeRecipeLinksTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  ids: readonly string[]
): Promise<void> {
  const { link, entity } = KINDS[kind];
  const unique = [...new Set(ids)];

  await tx.execute(sql`DELETE FROM ${link} WHERE recipe_id = ${recipeId}::uuid`);

  if (unique.length === 0) return;

  await tx.execute(sql`
    INSERT INTO ${link} (recipe_id, ${entity}, "order") VALUES ${sql.join(
      unique.map((id, order) => sql`(${recipeId}::uuid, ${id}::uuid, ${order})`),
      sql`, `
    )} ON CONFLICT DO NOTHING
  `);
}

/** A recipe's entry names, in order. */
export async function recipeEntryNames(
  kind: ListKind,
  recipeId: string,
  connection: Db = db
): Promise<string[]> {
  const { table, link, entity } = KINDS[kind];
  const rows = rowsOf<{ name: string }>(
    await connection.execute(sql`
      SELECT e.name FROM ${link} l JOIN ${table} e ON e.id = l.${entity}
      WHERE l.recipe_id = ${recipeId}::uuid ORDER BY l."order", e.name
    `)
  );

  return rows.map((row) => row.name);
}

/**
 * Adds the entries of `names` a recipe lacks (by fold) after the ones it has, from its household's
 * list, never removing one; returns the names it added and the recipe's names after.
 */
export async function appendRecipeEntriesTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  names: readonly string[]
): Promise<{ added: string[]; all: string[] }> {
  const { link, entity } = KINDS[kind];
  const existing = await recipeEntryNames(kind, recipeId, tx);
  const has = new Set(existing.map(entryFold));
  const householdId = await recipeHouseholdId(recipeId, tx);
  const fresh = names.map(cleanEntryName).filter((name) => name && !has.has(entryFold(name)));

  if (!householdId || fresh.length === 0) return { added: [], all: existing };

  const entries = await entriesForNamesTx(tx, kind, householdId, fresh, { create: true });
  const added = [...new Set(fresh.map(entryFold))].flatMap((fold) => entries.get(fold) ?? []);

  if (added.length > 0) {
    await tx.execute(sql`
      INSERT INTO ${link} (recipe_id, ${entity}, "order") VALUES ${sql.join(
        added.map(
          (entry, index) => sql`(${recipeId}::uuid, ${entry.id}::uuid, ${existing.length + index})`
        ),
        sql`, `
      )} ON CONFLICT DO NOTHING
    `);
  }

  return {
    added: added.map((entry) => entry.name),
    all: [...existing, ...added.map((e) => e.name)],
  };
}

export type AddEntryResult = { entry: ListEntryRow; created: boolean };

/**
 * Adds `name` to the household's list (or the instance's for the null scope). A name the list
 * already has, the instance's included, answers that entry, also when a concurrent add made it.
 */
export async function addEntry(
  kind: ListKind,
  scope: ListScope,
  name: string
): Promise<AddEntryResult | null> {
  const { table } = KINDS[kind];
  const cleaned = cleanEntryName(name);

  if (!cleaned) return null;

  const fold = entryFold(cleaned);
  const [created] = rowsOf<ListEntryRow>(
    await db.execute(sql`
      INSERT INTO ${table} AS e (household_id, name, name_fold)
      SELECT ${scope}::uuid, ${cleaned}, ${fold}
      WHERE NOT EXISTS (
        SELECT 1 FROM ${table} o WHERE o.household_id IS NULL AND o.name_fold = ${fold}
      )
      ON CONFLICT DO NOTHING
      RETURNING ${ROW_COLUMNS}
    `)
  );

  if (created) return { entry: created, created: true };

  const [existing] = rowsOf<ListEntryRow>(
    await db.execute(sql`
      SELECT ${ROW_COLUMNS} FROM ${table} e
      WHERE (${ownedBy(scope)} OR e.household_id IS NULL) AND e.name_fold = ${fold}
      ORDER BY e.household_id NULLS FIRST LIMIT 1
    `)
  );

  return existing ? { entry: existing, created: false } : null;
}

/** Moves every recipe from `sourceId` onto `targetId` without duplicates, then removes the source. */
export async function mergeEntryTx(
  tx: DbTransaction,
  kind: ListKind,
  sourceId: string,
  targetId: string
) {
  const { table, link, entity } = KINDS[kind];

  await tx.execute(sql`
    INSERT INTO ${link} (recipe_id, ${entity}, "order")
    SELECT recipe_id, ${targetId}::uuid, "order" FROM ${link} WHERE ${entity} = ${sourceId}::uuid
    ON CONFLICT DO NOTHING
  `);
  await tx.execute(sql`DELETE FROM ${link} WHERE ${entity} = ${sourceId}::uuid`);
  await tx.execute(sql`DELETE FROM ${table} WHERE id = ${sourceId}::uuid`);
}

/** The scope's entry `id`, locked for the change. */
async function lockOwnEntryTx(tx: DbTransaction, kind: ListKind, scope: ListScope, id: string) {
  const { table } = KINDS[kind];
  const [row] = rowsOf<ListEntryRow & { name_fold: string }>(
    await tx.execute(sql`
      SELECT ${ROW_COLUMNS}, e.name_fold FROM ${table} e
      WHERE e.id = ${id}::uuid AND ${ownedBy(scope)} FOR UPDATE
    `)
  );

  return row;
}

export type RenameEntryResult = { entry: ListEntryRow; merged: boolean };

/**
 * Renames the scope's entry `id`. A name the list already has (the instance's included) merges the
 * two in one transaction: the entry's recipes move onto the other and the entry goes.
 */
export async function renameEntry(
  kind: ListKind,
  scope: ListScope,
  id: string,
  name: string
): Promise<RenameEntryResult | null> {
  const { table } = KINDS[kind];
  const cleaned = cleanEntryName(name);

  if (!cleaned) return null;

  const fold = entryFold(cleaned);

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const own = await lockOwnEntryTx(tx, kind, scope, id);

        if (!own) return null;

        if (own.name_fold !== fold) {
          const [target] = rowsOf<ListEntryRow>(
            await tx.execute(sql`
              SELECT ${ROW_COLUMNS} FROM ${table} e
              WHERE (${ownedBy(scope)} OR e.household_id IS NULL) AND e.name_fold = ${fold}
              ORDER BY e.household_id NULLS FIRST LIMIT 1 FOR UPDATE
            `)
          );

          if (target) {
            await mergeEntryTx(tx, kind, id, target.id);

            return { entry: target, merged: true };
          }
        }

        const [renamed] = rowsOf<ListEntryRow>(
          await tx.execute(sql`
            UPDATE ${table} AS e SET name = ${cleaned}, name_fold = ${fold}, version = e.version + 1
            WHERE e.id = ${id}::uuid RETURNING ${ROW_COLUMNS}
          `)
        );

        return renamed ? { entry: renamed, merged: false } : null;
      });
    } catch (error) {
      // An entry of that name made meanwhile: the next attempt merges onto it.
      if (attempt > 0 || !isConstraintViolation(error, "23505")) throw error;
    }
  }
}

/**
 * Merges the scope's entry `sourceId` into `targetId`, the scope's own or an instance entry: the
 * source's recipes carry the target instead, once each, and the source goes.
 */
export async function mergeEntries(
  kind: ListKind,
  scope: ListScope,
  sourceId: string,
  targetId: string
): Promise<ListEntryRow | null> {
  const { table } = KINDS[kind];

  if (sourceId === targetId) return null;

  return await db.transaction(async (tx) => {
    // Both rows locked in id order, so two merges of the same pair cannot deadlock.
    const locked = rowsOf<ListEntryRow & { owned: boolean }>(
      await tx.execute(sql`
        SELECT ${ROW_COLUMNS}, ${ownedBy(scope)} AS owned FROM ${table} e
        WHERE e.id IN (${uuidListSql([sourceId, targetId])})
          AND (${ownedBy(scope)} OR e.household_id IS NULL)
        ORDER BY e.id FOR UPDATE
      `)
    );
    const source = locked.find((row) => row.id === sourceId && row.owned);
    const target = locked.find((row) => row.id === targetId);

    if (!source || !target) return null;

    await mergeEntryTx(tx, kind, sourceId, targetId);

    return { id: target.id, name: target.name, instance: target.instance, version: target.version };
  });
}

/** Deletes the scope's entry `id`, taking it off every recipe; returns how many it was on. */
export async function deleteEntry(
  kind: ListKind,
  scope: ListScope,
  id: string
): Promise<{ detached: number } | null> {
  const { table, link, entity } = KINDS[kind];

  return await db.transaction(async (tx) => {
    if (!(await lockOwnEntryTx(tx, kind, scope, id))) return null;

    const detached = rowsOf<{ recipe_id: string }>(
      await tx.execute(sql`DELETE FROM ${link} WHERE ${entity} = ${id}::uuid RETURNING recipe_id`)
    );

    await tx.execute(sql`DELETE FROM ${table} WHERE id = ${id}::uuid`);

    return { detached: detached.length };
  });
}

/** The scope's entry `id`, or null when it is no entry of the scope. */
export async function findOwnEntry(
  kind: ListKind,
  scope: ListScope,
  id: string
): Promise<ListEntryRow | null> {
  const { table } = KINDS[kind];
  const [row] = rowsOf<ListEntryRow>(
    await db.execute(
      sql`SELECT ${ROW_COLUMNS} FROM ${table} e WHERE e.id = ${id}::uuid AND ${ownedBy(scope)}`
    )
  );

  return row ?? null;
}

/** Recipes carrying an entry whose fold is one of `names`', at least `required` of them. */
export function recipeCarriesFoldsSql(kind: ListKind, names: readonly string[], required = 1): SQL {
  const { table, link, entity } = KINDS[kind];
  const folds = [...new Set(names.map(entryFold))].filter(Boolean);

  if (folds.length === 0) return sql`false`;

  return sql`(
    SELECT count(DISTINCT carried.name_fold) FROM ${link} carried_link
    JOIN ${table} carried ON carried.id = carried_link.${entity}
    WHERE carried_link.recipe_id = "recipes"."id" AND carried.name_fold IN (${sql.join(
      folds.map((fold) => sql`${fold}`),
      sql`, `
    )})
  ) >= ${required}`;
}
