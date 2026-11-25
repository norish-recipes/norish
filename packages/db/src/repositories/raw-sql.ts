import { sql } from "drizzle-orm";

/** `ids` as a SQL list of uuids. */
export const uuidListSql = (ids: readonly string[]) =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  );
