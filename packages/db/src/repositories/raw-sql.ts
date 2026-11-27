import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** `ids` as a SQL list of uuids. */
export const uuidListSql = (ids: readonly string[]) =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  );

/** One row to select constants from: the builder has no select without `from`. */
export const ONE_ROW = sql`(values (1)) as ${sql.identifier("one_row")}`;

/** `column`'s own default: an insert-from-select names every column. */
export const defaultOf = (column: AnyPgColumn) => sql`${column.default}`.as(column.name);
