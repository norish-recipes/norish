import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import type { Db } from "@norish/db/drizzle";
import { db } from "@norish/db/drizzle";
import { households, recurringGroceries, stores } from "@norish/db/schema";

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

/** The member a household row's catalogue work runs as: its adder, else its household's admin. */
export function rowActor(table: { userId: AnyPgColumn; householdId: AnyPgColumn }) {
  const admin = new QueryBuilder()
    .select({ adminUserId: households.adminUserId })
    .from(households)
    .where(eq(households.id, table.householdId));

  return sql<string>`coalesce(${table.userId}, ${admin})`;
}

/** Thrown where a write points a household's row at another household's row. */
export class ForeignHouseholdReferenceError extends Error {
  constructor() {
    super("A household row may only reference its own household's rows");
  }
}

/** Throws unless every Store and recurring grocery named here is the household's own. */
export async function assertOwnReferences(
  householdId: string,
  refs: {
    storeIds?: ReadonlyArray<string | null | undefined>;
    recurringGroceryIds?: ReadonlyArray<string | null | undefined>;
  },
  tx: Db = db
): Promise<void> {
  const named = (ids: ReadonlyArray<string | null | undefined> = []) => [
    ...new Set(ids.filter((id): id is string => !!id)),
  ];
  const own = async (table: typeof stores | typeof recurringGroceries, ids: string[]) => {
    if (ids.length === 0) return true;
    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(and(inArray(table.id, ids), eq(table.householdId, householdId)));

    return row?.count === ids.length;
  };

  if (
    !(await own(stores, named(refs.storeIds))) ||
    !(await own(recurringGroceries, named(refs.recurringGroceryIds)))
  ) {
    throw new ForeignHouseholdReferenceError();
  }
}
