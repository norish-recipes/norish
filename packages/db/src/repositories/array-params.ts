import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Postgres element types a list is bound as. */
type ElementType = "uuid" | "text" | "boolean";

/** A list bound as one array parameter of `type`, however many there are. */
export function arrayParam(values: readonly (string | boolean | null)[], type: ElementType): SQL {
  return sql`${sql.param([...values])}::${sql.raw(type)}[]`;
}

/** `column` is one of `values`, bound as one array however many there are. */
export function isAnyOf(column: AnyPgColumn, values: readonly string[], type: ElementType): SQL {
  return sql`${column} = any(${arrayParam(values, type)})`;
}

/**
 * A batch update's value for each row: `values` at the place its `key` has in `keys`, both bound as
 * one array; text, for the caller to cast.
 */
export function pickedByKey(
  key: AnyPgColumn,
  keys: readonly string[],
  keyType: ElementType,
  values: readonly (string | null)[]
): SQL {
  return sql`(${arrayParam(values, "text")})[array_position(${arrayParam(keys, keyType)}, ${key})]`;
}
