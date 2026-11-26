import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, eq, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

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

/** A row of another household's catalogue than `catalogue`: neither the seed's nor that household's. */
export function outsideCatalogue(householdId: AnyPgColumn, catalogue: string): SQL {
  return and(isNotNull(householdId), ne(householdId, catalogue))!;
}

/** Who acts on catalogue rows: a member of `householdId`, and whether a server admin. */
export interface CatalogueReader {
  householdId: string;
  isServerAdmin: boolean;
}

/**
 * The one rule for whose catalogue rows a reader edits, and whose AI Changes they see: their
 * household's, and the seed's (null) for an admin alone.
 */
export function editableHouseholds(reader: CatalogueReader): Array<string | null> {
  return reader.isServerAdmin ? [reader.householdId, null] : [reader.householdId];
}

/** `householdId` is one of the households the reader edits (`editableHouseholds`). */
export function editableBy(householdId: AnyPgColumn, reader: CatalogueReader): SQL {
  // False, never NULL, on a seeded row a member does not edit, so `not()` of it holds there.
  const edits = (one: string | null) =>
    one === null ? isNull(householdId) : and(isNotNull(householdId), eq(householdId, one))!;

  return or(...editableHouseholds(reader).map(edits))!;
}

/** Whether a row is the instance's, as a boolean column. */
export function isInstanceRow(householdId: AnyPgColumn) {
  return isNull(householdId).mapWith(Boolean);
}

/** Order a catalogue's rows so a household's own comes before the seed's of the same key. */
export function ownBeforeSeed(householdId: AnyPgColumn): SQL {
  return sql`${householdId} nulls last`;
}
