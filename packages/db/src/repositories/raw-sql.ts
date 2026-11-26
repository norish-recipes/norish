import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** `ids` as a SQL list of uuids. */
export const uuidListSql = (ids: readonly string[]) =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  );

/** `column`'s own default: an insert-from-select names every column. */
export const defaultOf = (column: AnyPgColumn) => sql`${column.default}`.as(column.name);
