import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { eq, isNull, or, sql } from "drizzle-orm";

/**
 * A household's catalogue is the seed plus its own foods, spellings and junk marks (ADR-0042):
 * `household_id` null is the seed's.
 */
export function inCatalogue(householdId: AnyPgColumn, catalogue: string): SQL {
  return or(eq(householdId, catalogue), isNull(householdId))!;
}

/** Order a catalogue's rows so a household's own comes before the seed's of the same key. */
export function ownBeforeSeed(householdId: AnyPgColumn): SQL {
  return sql`${householdId} nulls last`;
}

/** The rows a household sees (its own and the seed's), or the seed's alone (null). */
export function seenBy(householdId: AnyPgColumn, catalogue: string | null): SQL {
  return catalogue === null ? isNull(householdId) : inCatalogue(householdId, catalogue);
}
