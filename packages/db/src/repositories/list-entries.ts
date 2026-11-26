/** Tags, Cuisines and Categories as household lists (ADR-0043): a row is its household's (null for
 * the instance), unique on its fold there; a recipe carries its household's and the instance's. */
import type { SQL } from "drizzle-orm";
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
  not,
  notExists,
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
  households,
  recipeCategories,
  recipeCuisines,
  recipes,
  recipeTags,
  tags,
} from "@norish/db/schema";
import { LIST_NAME_MAX } from "@norish/shared/contracts/zod/list-entry";
import { entryFold } from "@norish/shared/lib/fold-name";
import { groupBy } from "@norish/shared/lib/group-by";
import { stripHtmlTags } from "@norish/shared/lib/helpers";

import type { MutationOutcome } from "./mutation-outcomes";
import { arrayParam, isAnyOf } from "./array-params";
import { isConstraintViolation } from "./constraint-violation";
import { ForeignHouseholdReferenceError, lockRecipeHouseholdsTx } from "./household-rows";
import { inScope, isInstanceRow } from "./household-scope";
import { lockUntilSettled } from "./lock-until-settled";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { defaultOf } from "./raw-sql";

export type ListKind = "tag" | "cuisine" | "category";

export const LIST_KINDS = ["tag", "cuisine", "category"] as const satisfies readonly ListKind[];

const KINDS = {
  tag: {
    table: tags,
    link: recipeTags,
    entity: recipeTags.tagId,
    linkRow: <R, E, O>(recipeId: R, tagId: E, order: O) => ({ recipeId, tagId, order }),
  },
  cuisine: {
    table: cuisines,
    link: recipeCuisines,
    entity: recipeCuisines.cuisineId,
    linkRow: <R, E, O>(recipeId: R, cuisineId: E, order: O) => ({ recipeId, cuisineId, order }),
  },
  category: {
    table: categories,
    link: recipeCategories,
    entity: recipeCategories.categoryId,
    linkRow: <R, E, O>(recipeId: R, categoryId: E, order: O) => ({ recipeId, categoryId, order }),
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
export interface ListEntry extends ListEntryRow {
  recipeCount: number;
}

/** A household's list, or the instance's entries alone when `householdId` is null. */
export type ListScope = string | null;

/** A name as a list stores it (no HTML, trimmed) with its fold; null when nothing is left. */
export function entryName(name: string): { name: string; fold: string } | null {
  const cleaned = stripHtmlTags(name).trim();

  return cleaned ? { name: cleaned, fold: entryFold(cleaned) } : null;
}

/** The columns of an entry as its list shows it. */
const rowColumns = (table: ListTable) => ({
  id: table.id,
  name: table.name,
  instance: isInstanceRow(table.householdId),
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

/** Holds each kind's `folds` until the commit: every write giving an entry a fold takes it, after the
 * household rows and before list rows, so a fold is never the instance's and a household's. */
export async function lockFoldsTx(
  tx: DbTransaction,
  folds: Partial<Record<ListKind, readonly string[]>>
): Promise<void> {
  const keys = [
    ...new Set(LIST_KINDS.flatMap((kind) => (folds[kind] ?? []).map((fold) => `${kind}:${fold}`))),
  ];
  const key = sql`fold_key.key`;

  if (keys.length === 0) return;
  // Taken in the key's order, so two writes of several folds cannot deadlock on them.
  await tx
    .select({ held: sql`pg_advisory_xact_lock(hashtextextended(${key}, 0))` })
    .from(sql`unnest(${arrayParam(keys, "text")}) as fold_key(key)`)
    .orderBy(key);
}

/** {@link lockFoldsTx} for one kind. */
export const lockEntryFoldsTx = (tx: DbTransaction, kind: ListKind, folds: readonly string[]) =>
  lockFoldsTx(tx, { [kind]: folds });

/** {@link lockFoldsTx} for the folds of each kind's `names`: a write of several lists takes them in
 * this one call, before any list's rows. */
export const lockEntryNamesTx = (
  tx: DbTransaction,
  names: Partial<Record<ListKind, readonly string[]>>
) =>
  lockFoldsTx(
    tx,
    Object.fromEntries(
      LIST_KINDS.map((kind) => [kind, (names[kind] ?? []).flatMap((n) => entryName(n)?.fold ?? [])])
    )
  );

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

/** Each household entry of `kind` folding like an instance entry, with that entry, by id. */
function householdTwinPairs(tx: DbTransaction, kind: ListKind) {
  const { table } = KINDS[kind];
  const instance = alias(table, "instance");

  return tx
    .select({ id: table.id, instanceId: instance.id, fold: table.nameFold })
    .from(table)
    .innerJoin(instance, and(isNull(instance.householdId), eq(instance.nameFold, table.nameFold)))
    .where(isNotNull(table.householdId))
    .orderBy(table.id);
}

/** The folds {@link takeOverHouseholdTwinsTx} locks, for a caller to take with its own in one call. */
export async function householdTwinFoldsTx(tx: DbTransaction, kind: ListKind) {
  return (await householdTwinPairs(tx, kind)).map((pair) => pair.fold);
}

/** Merges each household entry of `kind` folding like an instance entry into it; answers how many
 * went. Only data from before 0.28 holds such a pair. */
export async function takeOverHouseholdTwinsTx(tx: DbTransaction, kind: ListKind): Promise<number> {
  await lockEntryFoldsTx(tx, kind, await householdTwinFoldsTx(tx, kind));
  const pairs = await householdTwinPairs(tx, kind);

  for (const [instanceId, twins] of groupBy(pairs, (pair) => pair.instanceId)) {
    await mergeEntryTx(
      tx,
      kind,
      twins.map((twin) => twin.id),
      instanceId
    );
  }

  return pairs.length;
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

  // The join qualifies the columns, so the count correlates on the outer entry.
  const carriers = qb
    .select({ n: sql<number>`count(*)::int` })
    .from(link)
    .innerJoin(recipes, eq(recipes.id, link.recipeId))
    .where(and(eq(entity, table.id), eq(recipes.householdId, householdId)));

  return await db
    .select({ ...rowColumns(table), recipeCount: sql<number>`${carriers}` })
    .from(table)
    .where(inScope(table.householdId, householdId, { offered: true }))
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

  if (create) await holdHouseholdTx(tx, householdId);
  for (let attempt = 0; attempt < ATTACH_ATTEMPTS && found.size < wanted.size; attempt += 1) {
    const missing = [...wanted.keys()].filter((fold) => !found.has(fold));

    // A fold the list lacks is held before any entry is locked, so an instance add of it waits.
    if (create) {
      const listed = await tx
        .select({ fold: table.nameFold })
        .from(table)
        .where(
          and(
            inScope(table.householdId, householdId, { offered: true }),
            inArray(table.nameFold, missing)
          )
        );

      await lockEntryFoldsTx(
        tx,
        kind,
        missing.filter((fold) => !listed.some((row) => row.fold === fold))
      );
    }
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

/** Replaces a recipe's entries with `names`, in order, from the recipe's household's list;
 * answers how many names it found no entry for. */
export async function replaceRecipeEntriesByNameTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  names: readonly string[],
  { createEntries = true }: EntryWriteOptions = {}
): Promise<number> {
  const householdId = await lockedRecipeHouseholdTx(tx, recipeId);

  if (!householdId) return 0;

  const entries = await entriesByFoldTx(tx, kind, householdId, names, { create: createEntries });
  const ids = names.flatMap((name) => entries.get(entryName(name)?.fold ?? "")?.id ?? []);

  await writeRecipeLinksTx(tx, kind, householdId, recipeId, ids);

  return names.length - ids.length;
}

/** The recipe's household, held so no move takes the recipe elsewhere before the commit. */
async function lockedRecipeHouseholdTx(tx: DbTransaction, recipeId: string) {
  return (await lockRecipeHouseholdsTx(tx, { recipeIds: [recipeId] })).get(recipeId) ?? null;
}

/** Replaces a recipe's entries with `ids`: its household's and the instance's stay; another's takes
 * its fold's entry there (instance first), else ForeignHouseholdReferenceError; a gone id is counted. */
export async function replaceRecipeEntryIdsTx(
  tx: DbTransaction,
  kind: ListKind,
  recipeId: string,
  ids: readonly string[]
): Promise<number> {
  const { table } = KINDS[kind];
  const householdId = await lockedRecipeHouseholdTx(tx, recipeId);
  const unique = [...new Set(ids)];

  if (!householdId) return 0;
  const named = await tx
    .select({ id: table.id, householdId: table.householdId, nameFold: table.nameFold })
    .from(table)
    .where(isAnyOf(table.id, unique, "uuid"));
  const seen = (row: { householdId: string | null }) =>
    row.householdId === householdId || row.householdId === null;
  const staleFolds = named.filter((row) => !seen(row)).map((row) => row.nameFold);
  const homes =
    staleFolds.length === 0
      ? []
      : await tx
          .select({ id: table.id, householdId: table.householdId, nameFold: table.nameFold })
          .from(table)
          .where(
            and(
              inScope(table.householdId, householdId, { offered: true }),
              isAnyOf(table.nameFold, staleFolds, "text")
            )
          )
          .for("key share");
  const homeOf = new Map<string, string>();

  // An instance entry wins over a household's own of the same fold, as in `entriesByFoldTx`.
  for (const row of homes) {
    if (!homeOf.has(row.nameFold) || row.householdId === null) homeOf.set(row.nameFold, row.id);
  }
  const byId = new Map(named.map((row) => [row.id, row]));

  await writeRecipeLinksTx(
    tx,
    kind,
    householdId,
    recipeId,
    unique.flatMap((id) => {
      const row = byId.get(id);

      if (!row) return [];
      if (seen(row)) return [id];
      const home = homeOf.get(row.nameFold);

      if (!home) throw new ForeignHouseholdReferenceError();

      return [home];
    })
  );

  return unique.filter((id) => !byId.has(id)).length;
}

/** Inserts `links`, keeping a link already there; each entry must be `householdId`'s (the recipes'
 * household, held by the caller) or the instance's, else ForeignHouseholdReferenceError. */
async function insertLinksTx(
  tx: DbTransaction,
  kind: ListKind,
  householdId: string,
  links: readonly { recipeId: string; id: string; order: number }[]
): Promise<void> {
  const { table, link, linkRow } = KINDS[kind];

  if (links.length === 0) return;
  const [outside] = await tx
    .select({ count: count() })
    .from(table)
    .where(
      and(
        isAnyOf(
          table.id,
          links.map((row) => row.id),
          "uuid"
        ),
        not(inScope(table.householdId, householdId, { offered: true }))
      )
    );

  if (outside?.count) throw new ForeignHouseholdReferenceError();

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
  householdId: string,
  recipeId: string,
  ids: readonly string[]
): Promise<void> {
  const { link } = KINDS[kind];

  await tx.delete(link).where(eq(link.recipeId, recipeId));
  await insertLinksTx(tx, kind, householdId, linksOf(recipeId, [...new Set(ids)]));
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
  const householdId = await lockedRecipeHouseholdTx(tx, recipeId);
  const existing = await recipeEntryNames(kind, recipeId, tx);
  const has = new Set(existing.map(entryFold));
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
    householdId,
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

/** `households`: those whose entries of the name an instance entry took over. */
type AddEntryResult = { entry: ListEntryRow; created: boolean; households: string[] };

/** The instance's entry folded as `fold`, else the scope's. */
async function foldedEntry(
  connection: Db,
  kind: ListKind,
  scope: ListScope,
  fold: string
): Promise<ListEntryRow | undefined> {
  const { table } = KINDS[kind];
  const [row] = await connection
    .select(rowColumns(table))
    .from(table)
    .where(and(inScope(table.householdId, scope, { offered: true }), eq(table.nameFold, fold)))
    .orderBy(instanceFirst(table))
    .limit(1);

  return row;
}

/** The household's row, held so no join or leave moves its lists before the commit. */
async function holdHouseholdTx(tx: DbTransaction, householdId: string): Promise<void> {
  await tx
    .select({ id: households.id })
    .from(households)
    .where(eq(households.id, householdId))
    .for("key share");
}

/** An entry as a takeover or rename locks it. */
type LockedEntry = ListEntryRow & { householdId: string | null; nameFold: string };

const lockedColumns = (table: ListTable) => ({
  ...rowColumns(table),
  householdId: table.householdId,
  nameFold: table.nameFold,
});

/**
 * Before an instance entry takes `fold`: the households holding it (until settled), the fold,
 * their recipes carrying it, then every entry of the fold and `also`, by id; answers those entries.
 */
async function lockTakeoverTx(
  tx: DbTransaction,
  kind: ListKind,
  fold: string,
  also: string | null = null
): Promise<LockedEntry[]> {
  const { table, link, entity } = KINDS[kind];
  const twin = and(isNotNull(table.householdId), eq(table.nameFold, fold));
  const holders = async () =>
    (await tx.selectDistinct({ id: table.householdId }).from(table).where(twin)).flatMap(
      (row) => row.id ?? []
    );
  const lockHolders = () =>
    lockUntilSettled(
      holders,
      (ids) =>
        tx
          .select({ id: households.id })
          .from(households)
          .where(isAnyOf(households.id, ids, "uuid"))
          .orderBy(households.id)
          .for("key share"),
      (id) => id
    );

  // Households first; one that took the fold before the fold lock landed is locked after it.
  await lockHolders();
  await lockEntryFoldsTx(tx, kind, [fold]);
  await lockHolders();
  await tx
    .select({ id: recipes.id })
    .from(recipes)
    .where(
      inArray(
        recipes.id,
        qb
          .select({ id: link.recipeId })
          .from(link)
          .innerJoin(table, eq(table.id, entity))
          .where(twin)
      )
    )
    .orderBy(recipes.id)
    .for("key share");

  return await tx
    .select(lockedColumns(table))
    .from(table)
    .where(
      also === null ? eq(table.nameFold, fold) : or(eq(table.nameFold, fold), eq(table.id, also))
    )
    .orderBy(table.id)
    .for("update");
}

/** The households' `twins` merge into the instance entry `entry`; answers it and their households. */
async function takeOverTwinsTx(
  tx: DbTransaction,
  kind: ListKind,
  entry: ListEntryRow,
  twins: readonly LockedEntry[]
): Promise<{ entry: ListEntryRow; households: string[] }> {
  if (twins.length === 0) return { entry, households: [] };
  const merged = await mergeEntryTx(
    tx,
    kind,
    twins.map((twin) => twin.id),
    entry.id
  );

  return {
    entry: merged ?? entry,
    households: [...new Set(twins.flatMap((twin) => twin.householdId ?? []))],
  };
}

/** How often a takeover or rename runs again after a deadlock or a name made meanwhile. */
const CONFLICT_ATTEMPTS = 3;

async function retryingConflicts<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      const retryable =
        isConstraintViolation(error, "23505") || isConstraintViolation(error, "40P01");

      if (attempt >= CONFLICT_ATTEMPTS || !retryable) throw error;
    }
  }
}

/** Adds `name` to the scope's list. A name it has, the instance's included, answers that entry,
 * also when a concurrent add made it; an instance entry takes over the households' of its name. */
export async function addEntry(
  kind: ListKind,
  scope: ListScope,
  name: string
): Promise<AddEntryResult | null> {
  const { table } = KINDS[kind];
  const entry = entryName(name);

  if (!entry) return null;
  if (scope === null) return await addInstanceEntry(kind, entry);

  return await db.transaction(async (tx) => {
    await holdHouseholdTx(tx, scope);
    await lockEntryFoldsTx(tx, kind, [entry.fold]);
    const existing = await foldedEntry(tx, kind, scope, entry.fold);

    if (existing) return { entry: existing, created: false, households: [] };
    const [created] = await tx
      .insert(table)
      .values({ householdId: scope, name: entry.name, nameFold: entry.fold })
      .onConflictDoNothing()
      .returning(rowColumns(table));

    if (created) return { entry: created, created: true, households: [] };
    // Only a write that skipped the fold lock gets here.
    const made = await foldedEntry(tx, kind, scope, entry.fold);

    return made ? { entry: made, created: false, households: [] } : null;
  });
}

async function addInstanceEntry(
  kind: ListKind,
  entry: { name: string; fold: string }
): Promise<AddEntryResult | null> {
  const { table } = KINDS[kind];

  return await retryingConflicts(() =>
    db.transaction(async (tx) => {
      const locked = await lockTakeoverTx(tx, kind, entry.fold);
      const existing = locked.find((row) => row.householdId === null);

      if (existing) return { entry: asEntryRow(existing), created: false, households: [] };
      const [created] = await tx
        .insert(table)
        .values({ householdId: null, name: entry.name, nameFold: entry.fold })
        .returning(rowColumns(table));

      return created
        ? { created: true, ...(await takeOverTwinsTx(tx, kind, created, locked)) }
        : null;
    })
  );
}

/** Moves every recipe from `sourceIds` onto `targetId` without duplicates, removes the sources and
 * answers the target, its version bumped. */
export async function mergeEntryTx(
  tx: DbTransaction,
  kind: ListKind,
  sourceIds: readonly string[],
  targetId: string
): Promise<ListEntryRow | undefined> {
  const { table, link, entity, linkRow } = KINDS[kind];

  // One statement, so a link attached or dropped meanwhile is moved as it stands; any count.
  await tx
    .insert(link)
    .select(
      qb
        .select({
          ...linkRow(link.recipeId, sql<string>`${targetId}::uuid`.as(entity.name), link.order),
          createdAt: defaultOf(link.createdAt),
          version: defaultOf(link.version),
        })
        .from(link)
        .where(isAnyOf(entity, sourceIds, "uuid"))
    )
    .onConflictDoNothing();
  await tx.delete(link).where(isAnyOf(entity, sourceIds, "uuid"));
  await tx.delete(table).where(isAnyOf(table.id, sourceIds, "uuid"));

  const [target] = await tx
    .update(table)
    .set({ version: sql`${table.version} + 1` })
    .where(eq(table.id, targetId))
    .returning(rowColumns(table));

  return target;
}

/** Gives `householdId` an entry of each fold of `ids` (a leaver's carried or a joiner's entries,
 * folds held): the instance's, else its own, else a copy; its recipes carrying `ids` carry that. */
async function takeEntriesOfFoldsTx(
  tx: DbTransaction,
  kind: ListKind,
  householdId: string,
  ids: readonly string[]
): Promise<void> {
  const { table, link, entity, linkRow } = KINDS[kind];
  const foreign = alias(table, "foreign_entry");
  const home = alias(table, "home_entry");
  const instance = alias(table, "instance_entry");

  if (ids.length === 0) return;
  // The entries those folds land on are held against a delete until the move commits.
  await tx
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        inScope(table.householdId, householdId, { offered: true }),
        inArray(
          table.nameFold,
          qb
            .select({ fold: foreign.nameFold })
            .from(foreign)
            .where(isAnyOf(foreign.id, ids, "uuid"))
        )
      )
    )
    .for("key share");
  await tx
    .insert(table)
    .select(
      qb
        .selectDistinctOn([foreign.nameFold], {
          id: defaultOf(table.id),
          householdId: sql<string>`${householdId}::uuid`.as(table.householdId.name),
          name: foreign.name,
          nameFold: foreign.nameFold,
          createdAt: defaultOf(table.createdAt),
          version: defaultOf(table.version),
        })
        .from(foreign)
        .where(
          and(
            isAnyOf(foreign.id, ids, "uuid"),
            notExists(
              qb
                .select({ id: instance.id })
                .from(instance)
                .where(and(isNull(instance.householdId), eq(instance.nameFold, foreign.nameFold)))
            )
          )
        )
        .orderBy(foreign.nameFold, foreign.id)
    )
    .onConflictDoNothing();

  const householdRecipes = qb
    .select({ id: recipes.id })
    .from(recipes)
    .where(eq(recipes.householdId, householdId));

  await tx
    .insert(link)
    .select(
      qb
        .select({
          ...linkRow(link.recipeId, home.id, link.order),
          createdAt: defaultOf(link.createdAt),
          version: defaultOf(link.version),
        })
        .from(link)
        .innerJoin(foreign, eq(foreign.id, entity))
        .innerJoin(
          home,
          and(
            inScope(home.householdId, householdId, { offered: true }),
            eq(home.nameFold, foreign.nameFold)
          )
        )
        .where(and(isAnyOf(entity, ids, "uuid"), inArray(link.recipeId, householdRecipes)))
    )
    .onConflictDoNothing();
  await tx
    .delete(link)
    .where(and(isAnyOf(entity, ids, "uuid"), inArray(link.recipeId, householdRecipes)));
}

/** Each kind's folds as `read` answers them, one kind after another. */
async function foldsByKind(
  read: (list: (typeof KINDS)[ListKind], kind: ListKind) => Promise<readonly { fold: string }[]>
) {
  const folds: Partial<Record<ListKind, string[]>> = {};

  for (const kind of LIST_KINDS)
    folds[kind] = (await read(KINDS[kind], kind)).map((row) => row.fold);

  return folds;
}

/** After a leave (ADR-0043): no recipe of the household carries another household's entry; each
 * becomes the household's own of its fold. The carried entries are held against a change meanwhile. */
export async function carryRecipeEntriesTx(tx: DbTransaction, householdId: string): Promise<void> {
  const carried = (kind: ListKind) => {
    const { table, link, entity } = KINDS[kind];

    return () =>
      tx
        .select({ id: table.id, fold: table.nameFold })
        .from(table)
        .where(
          and(
            isNotNull(table.householdId),
            ne(table.householdId, householdId),
            inArray(
              table.id,
              qb
                .select({ id: entity })
                .from(link)
                .innerJoin(recipes, eq(recipes.id, link.recipeId))
                .where(eq(recipes.householdId, householdId))
            )
          )
        );
  };

  // Every kind's folds in one call before any entry is locked.
  await lockFoldsTx(tx, await foldsByKind((_list, kind) => carried(kind)()));
  const foreign = new Map<ListKind, { id: string; fold: string }[]>();

  for (const kind of LIST_KINDS) {
    const { table } = KINDS[kind];
    const foreignEntries = await lockUntilSettled(
      carried(kind),
      (rows) =>
        tx
          .select({ id: table.id })
          .from(table)
          .where(
            isAnyOf(
              table.id,
              rows.map((row) => row.id),
              "uuid"
            )
          )
          .orderBy(table.id)
          .for("share"),
      (row) => row.id
    );

    foreign.set(kind, foreignEntries);
  }
  // An entry renamed before the lock landed; the folds already held are taken again at no wait.
  await lockFoldsTx(tx, await foldsByKind(async (_list, kind) => foreign.get(kind) ?? []));
  for (const kind of LIST_KINDS) {
    await takeEntriesOfFoldsTx(
      tx,
      kind,
      householdId,
      (foreign.get(kind) ?? []).map((row) => row.id)
    );
  }
}

/** A household of one's lists join `into` (ADR-0043), after its recipes moved: each entry becomes
 * `into`'s of its fold, its own where it has one, and the joiner's go. */
export async function mergeHouseholdEntriesTx(
  tx: DbTransaction,
  from: string,
  into: string
): Promise<void> {
  // The joiner's household is held, so its folds cannot change before their lock.
  await lockFoldsTx(
    tx,
    await foldsByKind(({ table }) =>
      tx.select({ fold: table.nameFold }).from(table).where(eq(table.householdId, from))
    )
  );
  for (const kind of LIST_KINDS) {
    const { table } = KINDS[kind];
    const joinerEntries = await tx
      .select({ id: table.id })
      .from(table)
      .where(eq(table.householdId, from))
      .orderBy(table.id)
      .for("update");

    await takeEntriesOfFoldsTx(
      tx,
      kind,
      into,
      joinerEntries.map((row) => row.id)
    );
    await tx.delete(table).where(eq(table.householdId, from));
  }
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

/** The household's entry `id` and the entries its list has of `fold`, by id, after the fold. */
async function lockHouseholdRenameTx(
  tx: DbTransaction,
  kind: ListKind,
  householdId: string,
  fold: string,
  id: string
): Promise<LockedEntry[]> {
  const { table } = KINDS[kind];

  await holdHouseholdTx(tx, householdId);
  await lockEntryFoldsTx(tx, kind, [fold]);

  return await tx
    .select(lockedColumns(table))
    .from(table)
    .where(
      and(
        inScope(table.householdId, householdId, { offered: true }),
        or(eq(table.id, id), eq(table.nameFold, fold))
      )
    )
    .orderBy(table.id)
    .for("update");
}

type RenameEntryResult = { entry: ListEntryRow; merged: boolean; households: string[] };

/** Renames the scope's entry, stale when changed since `version`; a name the list has (the
 * instance's first) merges onto it. An instance entry renamed takes the households' of its name. */
export async function renameEntry(
  kind: ListKind,
  scope: ListScope,
  { id, version }: EntryRef,
  name: string
): Promise<MutationOutcome<RenameEntryResult> | null> {
  const { table } = KINDS[kind];
  const entry = entryName(name);

  if (!entry) return null;

  return await retryingConflicts(() =>
    db.transaction(async (tx) => {
      const locked =
        scope === null
          ? await lockTakeoverTx(tx, kind, entry.fold, id)
          : await lockHouseholdRenameTx(tx, kind, scope, entry.fold, id);
      const own = locked.find((row) => row.id === id && row.householdId === scope);

      if (!own) return null;
      if (own.version !== version) return staleOutcome<RenameEntryResult>();
      const others = locked.filter((row) => row.id !== id && row.nameFold === entry.fold);
      const twins = scope === null ? others.filter((row) => row.householdId !== null) : [];
      const target =
        own.nameFold === entry.fold
          ? undefined
          : (others.find((row) => row.householdId === null) ??
            (scope === null ? undefined : others[0]));

      if (target) {
        const merged = await mergeEntryTx(tx, kind, [id], target.id);

        return merged
          ? appliedOutcome({ merged: true, ...(await takeOverTwinsTx(tx, kind, merged, twins)) })
          : null;
      }

      const [renamed] = await tx
        .update(table)
        .set({ name: entry.name, nameFold: entry.fold, version: sql`${table.version} + 1` })
        .where(eq(table.id, id))
        .returning(rowColumns(table));

      return renamed
        ? appliedOutcome({ merged: false, ...(await takeOverTwinsTx(tx, kind, renamed, twins)) })
        : null;
    })
  );
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

    const merged = await mergeEntryTx(tx, kind, [source.id], target.id);

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

/** The table that links recipes to the entries of a kind, with its recipe and entry columns. */
export function entryLinkOf(kind: ListKind) {
  const { link, entity } = KINDS[kind];

  return { link, recipeId: link.recipeId, entityId: entity };
}

/** How many recipes, in every household, carry the entry: what deleting an instance entry detaches. */
export async function countEntryRecipes(kind: ListKind, id: string): Promise<number> {
  const { link, entity } = KINDS[kind];
  const [row] = await db.select({ n: count() }).from(link).where(eq(entity, id));

  return row?.n ?? 0;
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
