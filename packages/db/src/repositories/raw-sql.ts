import { sql } from "drizzle-orm";

/** `ids` as a SQL list of uuids. */
export const uuidListSql = (ids: string[]) =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  );

/** The rows of a raw `db.execute` result. */
export function rowsOf<T>(result: unknown): T[] {
  return ((result as { rows?: T[] }).rows ?? []) as T[];
}
