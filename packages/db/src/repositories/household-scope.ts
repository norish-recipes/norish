import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { eq, isNull, or, sql } from "drizzle-orm";

/**
 * Tables a household shares with the instance, by `household_id`: null is the instance's row (the
 * catalogue seed, ADR-0042; an instance list entry, ADR-0043). The scope may be a column or subquery.
 */
type Scope = string | SQL | AnyPgColumn | null;

/** A household's own rows, or the instance's for null; with `offered`, the instance's too. */
export function inScope(
  householdId: AnyPgColumn,
  scope: Scope,
  { offered = false }: { offered?: boolean } = {}
): SQL {
  if (scope === null) return isNull(householdId);

  const own = eq(householdId, scope);

  return offered ? or(own, isNull(householdId))! : own;
}

/** A household's catalogue: the seed plus its own foods, spellings and junk marks; null, the seed's. */
export function inCatalogue(householdId: AnyPgColumn, catalogue: Scope): SQL {
  return inScope(householdId, catalogue, { offered: true });
}

/** Whether a row is the instance's, as a boolean column. */
export function isInstanceRow(householdId: AnyPgColumn) {
  return isNull(householdId).mapWith(Boolean);
}

/** Order a catalogue's rows so a household's own comes before the seed's of the same key. */
export function ownBeforeSeed(householdId: AnyPgColumn): SQL {
  return sql`${householdId} nulls last`;
}
