import type { SQL } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { and, count, eq } from "drizzle-orm";

import type { Db, DbTransaction } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import {
  households,
  ingredientAliases,
  ingredients,
  recipeIngredients,
  recipes,
  recurringGroceries,
  stores,
} from "@norish/db/schema";

import { isAnyOf } from "./array-params";
import { outsideCatalogue } from "./household-scope";
import { lockUntilSettled } from "./lock-until-settled";

/** A household-owned table, as the by-id condition reads it (ADR-0041). */
interface HouseholdTable {
  id: AnyPgColumn;
  householdId: AnyPgColumn;
  version: AnyPgColumn;
}

/** The acting household's row `id`, at `version` when one is given. */
export function householdRow(
  table: HouseholdTable,
  householdId: string,
  id: string,
  version?: number | null
): SQL {
  return and(
    eq(table.id, id),
    eq(table.householdId, householdId),
    version ? eq(table.version, version) : undefined
  )!;
}

/** The acting household's rows among `ids`. */
export function householdRows(table: HouseholdTable, householdId: string, ids: string[]): SQL {
  return and(isAnyOf(table.id, ids, "uuid"), eq(table.householdId, householdId))!;
}

/** Thrown where a write points a household's row at another household's row. */
export class ForeignHouseholdReferenceError extends Error {
  constructor() {
    super("A household row may only reference its own household's rows");
  }
}

type Ids = ReadonlyArray<string | null | undefined>;

const named = (ids: Ids = []) => [...new Set(ids.filter((id): id is string => !!id))];

/**
 * The ids among these that exist, refusing any another household holds: a reference to another
 * household's row answers like a missing one (ADR-0041).
 */
export async function ownRowIds(
  table: PgTable & Pick<HouseholdTable, "id" | "householdId">,
  householdId: string,
  ids: Ids = [],
  tx: Db = db
): Promise<Set<string>> {
  const wanted = named(ids);

  if (wanted.length === 0) return new Set();
  const rows = await tx
    .select({ id: table.id, householdId: table.householdId })
    .from(table)
    .where(isAnyOf(table.id, wanted, "uuid"));

  if (rows.some((row) => row.householdId !== householdId)) {
    throw new ForeignHouseholdReferenceError();
  }

  return new Set(rows.map((row) => String(row.id)));
}

/**
 * Throws unless every Store and recurring grocery named here is the household's own, and no food or
 * spelling is outside its catalogue (ADR-0042); one gone is the foreign key's to refuse.
 */
export async function assertOwnReferences(
  householdId: string,
  refs: {
    storeIds?: Ids;
    recurringGroceryIds?: Ids;
    ingredientIds?: Ids;
    ingredientAliasIds?: Ids;
  },
  tx: Db = db
): Promise<void> {
  const outside = async (table: typeof ingredients | typeof ingredientAliases, ids: string[]) => {
    if (ids.length === 0) return false;
    const [row] = await tx
      .select({ count: count() })
      .from(table)
      .where(and(isAnyOf(table.id, ids, "uuid"), outsideCatalogue(table.householdId, householdId)));

    return (row?.count ?? 0) > 0;
  };
  const checks = await Promise.all([
    ownRowIds(stores, householdId, refs.storeIds, tx),
    ownRowIds(recurringGroceries, householdId, refs.recurringGroceryIds, tx),
    outside(ingredients, named(refs.ingredientIds)),
    outside(ingredientAliases, named(refs.ingredientAliasIds)),
  ]);

  if (checks.includes(true)) throw new ForeignHouseholdReferenceError();
}

/**
 * The households of these recipes (or of these lines' recipes), held `FOR KEY SHARE` before any
 * recipe row, so no leave or join moves them until the commit: a write attaching to a recipe then
 * reads the household it lands in. A move committed while the lock was awaited is read again.
 */
export async function lockRecipeHouseholdsTx(
  tx: DbTransaction,
  of: { recipeIds: readonly string[] } | { lineIds: readonly string[] }
): Promise<Map<string, string>> {
  const ids = "recipeIds" in of ? of.recipeIds : of.lineIds;

  if (ids.length === 0) return new Map();
  const read = () =>
    "recipeIds" in of
      ? tx
          .select({ id: recipes.id, householdId: recipes.householdId })
          .from(recipes)
          .where(isAnyOf(recipes.id, ids, "uuid"))
      : tx
          .select({ id: recipeIngredients.id, householdId: recipes.householdId })
          .from(recipeIngredients)
          .innerJoin(recipes, eq(recipes.id, recipeIngredients.recipeId))
          .where(isAnyOf(recipeIngredients.id, ids, "uuid"));
  const rows = await lockUntilSettled(
    read,
    (fresh) =>
      tx
        .select({ id: households.id })
        .from(households)
        .where(
          isAnyOf(
            households.id,
            fresh.map((row) => row.householdId),
            "uuid"
          )
        )
        .orderBy(households.id)
        .for("key share"),
    (row) => `${row.id} ${row.householdId}`
  );

  return new Map(rows.map((row) => [row.id, row.householdId]));
}
