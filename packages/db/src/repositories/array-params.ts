import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** The array type of each Postgres element type a list is bound as. */
const ARRAY_TYPES = { uuid: sql`uuid[]`, text: sql`text[]`, boolean: sql`boolean[]` };

type ElementType = keyof typeof ARRAY_TYPES;

/** A list bound as one array parameter of `type`, however many there are. */
export function arrayParam(values: readonly (string | boolean | null)[], type: ElementType): SQL {
  return sql`${sql.param([...values])}::${ARRAY_TYPES[type]}`;
}

/** `column` is one of `values`, bound as one array however many there are. */
export function isAnyOf(column: AnyPgColumn, values: readonly string[], type: ElementType): SQL {
  return sql`${column} = any(${arrayParam(values, type)})`;
}

/**
 * A batch update's value for each row: the one of `values` paired with its `key` in `keys`, both
 * bound as one array; text, for the caller to cast. The pairs make one map, built once per statement.
 */
export function pickedByKey(
  key: AnyPgColumn,
  keys: readonly string[],
  keyType: ElementType,
  values: readonly (string | null)[]
): SQL {
  const pairs = sql`jsonb_object(${arrayParam(keys, keyType)}::text[], ${arrayParam(values, "text")})`;

  return sql`(${pairs} ->> ${key}::text)`;
}
