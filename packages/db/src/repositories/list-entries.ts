/** Tags, Cuisines and Categories as household lists (ADR-0043): a row is its household's (null for
 * the instance), unique on its fold there; a recipe carries its household's and the instance's. */
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

import type { MutationOutcome } from "./mutation-outcomes";
import { isConstraintViolation } from "./constraint-violation";
import { ForeignHouseholdReferenceError } from "./household-rows";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
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
 * The rows of a scope: a household's own, or the instance's for null; with `offered`, the instance's
 * too, as a household's list offers them. The household may be a subquery.
 */
export function inScope(
  scope: ListScope | SQL,
  { offered = false, alias = sql.raw("e") }: { offered?: boolean; alias?: SQL } = {}
): SQL {
  if (scope === null) return sql`${alias}.household_id IS NULL`;

  const own = sql`${alias}.household_id = ${scope}::uuid`;

  return offered ? sql`(${own} OR ${alias}.household_id IS NULL)` : own;
}

const ROW_COLUMNS = sql`e.id, e.name, (e.household_id IS NULL) AS instance, e.version`;

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
      WHERE self.id = ${id}::uuid AND e.id <> self.id AND ${inScope(scope)} AND e.name_fold = ${fold}
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
    SELECT ${ROW_COLUMNS} FROM ${table} e WHERE ${inScope(householdId, { offered: true })}
    ORDER BY lower(e.name), e.id
  `);

  return rowsOf<ListEntryRow>(result);
}

/** {@link listEntryRows}' names. */
export async function listEntryNames(kind: ListKind, householdId: string): Promise<string[]> {
  return (await listEntryRows(kind, householdId)).map((entry) => entry.name);
}

/** {@link listEntryRows} with how many of the household's recipes carry each. */
export async function listEntries(kind: ListKind, householdId: string): Promise<ListEntry[]> {
  const { table, link, entity } = KINDS[kind];
  const result = await db.execute(sql`
    SELECT ${ROW_COLUMNS}, (
      SELECT count(*)::int FROM ${link} l JOIN ${recipes} r ON r.id = l.recipe_id
      WHERE l.${entity} = e.id AND r.household_id = ${householdId}::uuid
    ) AS "recipeCount"
    FROM ${table} e WHERE ${inScope(householdId, { offered: true })}
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

/** How often a find-or-create looks again for a row a concurrent merge or delete removed. */
const ATTACH_ATTEMPTS = 3;

/** The household's (or instance's) entries for `names`, keyed by fold, the missing ones created
 * when `create`; held `FOR KEY SHARE`, so a merge or delete waits for the attach. */
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
    const rows = rowsOf<ListEntryRow & { name_fold: string }>(
      await tx.execute(sql`
        SELECT ${ROW_COLUMNS}, e.name_fold FROM ${table} e
        WHERE ${inScope(householdId, { offered: true })} AND e.name_fold IN (${sql.join(
          missing.map((fold) => sql`${fold}`),
          sql`, `
        )})
        ORDER BY e.household_id NULLS FIRST
        FOR KEY SHARE
      `)
    );

    // An instance entry wins over a household's own of the same fold.
    for (const row of rows) {
      if (!found.has(row.name_fold)) found.set(row.name_fold, asEntryRow(row));
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

  const entries = await entriesByFoldTx(tx, kind, householdId, names, { create: true });
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
    const allowed = rowsOf<{ id: string }>(
      await tx.execute(sql`
        SELECT e.id FROM ${table} e
        WHERE e.id IN (${uuidListSql(unique)}) AND (
          ${inScope(sql`(SELECT household_id FROM ${recipes} WHERE id = ${recipeId}::uuid)`, { offered: true })}
          OR EXISTS (SELECT 1 FROM ${link} l WHERE l.recipe_id = ${recipeId}::uuid AND l.${entity} = e.id)
        )
        FOR KEY SHARE
      `)
    );

    if (allowed.length !== unique.length) throw new ForeignHouseholdReferenceError();
  }

  await writeRecipeLinksTx(tx, kind, recipeId, unique);
}

/** Inserts `links` (`VALUES` or a `SELECT` of recipe, entry and order), keeping one already there. */
async function insertLinksTx(tx: DbTransaction, kind: ListKind, links: SQL): Promise<void> {
  const { link, entity } = KINDS[kind];

  await tx.execute(
    sql`INSERT INTO ${link} (recipe_id, ${entity}, "order") ${links} ON CONFLICT DO NOTHING`
  );
}

/** `VALUES` linking `recipeId` to `ids` in order, the first at `from`. */
function linkValues(recipeId: string, ids: readonly string[], from = 0): SQL {
  return sql`VALUES ${sql.join(
    ids.map((id, index) => sql`(${recipeId}::uuid, ${id}::uuid, ${from + index})`),
    sql`, `
  )}`;
}

async function writeRecipeLinksTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  ids: readonly string[]
): Promise<void> {
  const unique = [...new Set(ids)];

  await tx.execute(sql`DELETE FROM ${KINDS[kind].link} WHERE recipe_id = ${recipeId}::uuid`);

  if (unique.length > 0) await insertLinksTx(tx, kind, linkValues(recipeId, unique));
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

  if (added.length > 0) {
    await insertLinksTx(
      tx,
      kind,
      linkValues(
        recipeId,
        added.map((entry) => entry.id),
        existing.length
      )
    );
  }

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
  const [row] = rowsOf<ListEntryRow>(
    await connection.execute(sql`
      SELECT ${ROW_COLUMNS} FROM ${KINDS[kind].table} e
      WHERE ${inScope(scope, { offered: true })} AND e.name_fold = ${fold}
      ORDER BY e.household_id NULLS FIRST LIMIT 1 ${lock ? sql`FOR UPDATE` : sql``}
    `)
  );

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

  const [created] = rowsOf<ListEntryRow>(
    await db.execute(sql`
      INSERT INTO ${table} AS e (household_id, name, name_fold)
      SELECT ${scope}::uuid, ${entry.name}, ${entry.fold}
      WHERE NOT EXISTS (
        SELECT 1 FROM ${table} o
        WHERE ${inScope(null, { alias: sql.raw("o") })} AND o.name_fold = ${entry.fold}
      )
      ON CONFLICT DO NOTHING
      RETURNING ${ROW_COLUMNS}
    `)
  );

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

  await insertLinksTx(
    tx,
    kind,
    sql`SELECT recipe_id, ${targetId}::uuid, "order" FROM ${link} WHERE ${entity} = ${sourceId}::uuid`
  );
  await tx.execute(sql`DELETE FROM ${link} WHERE ${entity} = ${sourceId}::uuid`);
  await tx.execute(sql`DELETE FROM ${table} WHERE id = ${sourceId}::uuid`);

  const [target] = rowsOf<ListEntryRow>(
    await tx.execute(sql`
      UPDATE ${table} AS e SET version = e.version + 1 WHERE e.id = ${targetId}::uuid
      RETURNING ${ROW_COLUMNS}
    `)
  );

  return target;
}

/** An entry as a change names it: the version the caller last read. */
type EntryRef = { id: string; version: number };

/** The scope's entry `id`, locked for the change. */
async function lockOwnEntryTx(tx: DbTransaction, kind: ListKind, scope: ListScope, id: string) {
  const { table } = KINDS[kind];
  const [row] = rowsOf<ListEntryRow & { name_fold: string }>(
    await tx.execute(sql`
      SELECT ${ROW_COLUMNS}, e.name_fold FROM ${table} e
      WHERE e.id = ${id}::uuid AND ${inScope(scope)} FOR UPDATE
    `)
  );

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

        if (own.name_fold !== entry.fold) {
          const target = await foldedEntry(tx, kind, scope, entry.fold, true);

          if (target) {
            const merged = await mergeEntryTx(tx, kind, id, target.id);

            return merged ? appliedOutcome({ entry: merged, merged: true }) : null;
          }
        }

        const [renamed] = rowsOf<ListEntryRow>(
          await tx.execute(sql`
            UPDATE ${table} AS e SET name = ${entry.name}, name_fold = ${entry.fold}, version = e.version + 1
            WHERE e.id = ${id}::uuid RETURNING ${ROW_COLUMNS}
          `)
        );

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
    const locked = rowsOf<ListEntryRow & { owned: boolean }>(
      await tx.execute(sql`
        SELECT ${ROW_COLUMNS}, ${inScope(scope)} AS owned FROM ${table} e
        WHERE e.id IN (${uuidListSql([source.id, target.id])})
          AND ${inScope(scope, { offered: true })}
        ORDER BY e.id FOR UPDATE
      `)
    );
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

    const detached = rowsOf<{ recipe_id: string }>(
      await tx.execute(sql`DELETE FROM ${link} WHERE ${entity} = ${id}::uuid RETURNING recipe_id`)
    );

    await tx.execute(sql`DELETE FROM ${table} WHERE id = ${id}::uuid`);

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
  const [row] = rowsOf<ListEntryRow>(
    await db.execute(
      sql`SELECT ${ROW_COLUMNS} FROM ${table} e WHERE e.id = ${id}::uuid AND ${inScope(scope)}`
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
