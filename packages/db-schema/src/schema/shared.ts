import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { integer, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Shared mutable-row metadata columns.
 *
 * Use the spread operator inside a pgTable column map to add `createdAt`,
 * `updatedAt`, and `version` in one shot:
 *
 * ```ts
 * import { mutableRowColumns } from "./shared";
 *
 * export const myTable = pgTable("my_table", {
 *   id: uuid("id").defaultRandom().primaryKey(),
 *   ...mutableRowColumns,
 * });
 * ```
 *
 * Tables that already define their own timestamp modes or options should
 * add `version` directly instead of using this helper.
 */
export const mutableRowColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  version: integer("version").notNull().default(1),
} as const;

/**
 * Standalone version column for tables that define their own timestamp
 * columns (e.g. BetterAuth-style `mode: "date"` timestamps) and only
 * need the version token added.
 */
export const versionColumn = {
  version: integer("version").notNull().default(1),
} as const;

/** A recipe's or cookbook's household, which a trigger always sets to its Owner's current one
 * (migration 0090), whatever a write says; `households` is passed in, as it imports this file. */
export function householdIdFilledByTrigger(households: () => AnyPgColumn) {
  return uuid("household_id")
    .notNull()
    .references(households, { onDelete: "cascade" })
    .$defaultFn(() => sql`NULL`);
}
