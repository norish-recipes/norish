import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, count, eq, inArray } from "drizzle-orm";

import type { Db } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { ingredientAliases, ingredients, recurringGroceries, stores } from "@norish/db/schema";

import { outsideCatalogue } from "./household-scope";

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
  return and(inArray(table.id, ids), eq(table.householdId, householdId))!;
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
  const counted = async (
    table:
      typeof stores | typeof recurringGroceries | typeof ingredients | typeof ingredientAliases,
    ids: string[],
    where: SQL
  ) => {
    if (ids.length === 0) return 0;
    const [row] = await tx
      .select({ count: count() })
      .from(table)
      .where(and(inArray(table.id, ids), where));

    return row?.count ?? 0;
  };
  const own = async (table: typeof stores | typeof recurringGroceries, ids: string[]) =>
    (await counted(table, ids, eq(table.householdId, householdId))) === ids.length;
  const inside = async (table: typeof ingredients | typeof ingredientAliases, ids: string[]) =>
    (await counted(table, ids, outsideCatalogue(table.householdId, householdId))) === 0;
  const checks = await Promise.all([
    own(stores, named(refs.storeIds)),
    own(recurringGroceries, named(refs.recurringGroceryIds)),
    inside(ingredients, named(refs.ingredientIds)),
    inside(ingredientAliases, named(refs.ingredientAliasIds)),
  ]);

  if (checks.includes(false)) throw new ForeignHouseholdReferenceError();
}
