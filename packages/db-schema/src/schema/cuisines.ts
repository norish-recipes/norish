import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";
import { versionColumn } from "./shared";

/**
 * Cuisines (ADR-0012, ADR-0043): the administrator's are the instance entries
 * (`household_id` null), offered to every household beside the household's own.
 */
export const cuisines = pgTable(
  "cuisines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameFold: text("name_fold").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uq_cuisines_household_fold")
      .on(t.householdId, t.nameFold)
      .where(sql`${t.householdId} IS NOT NULL`),
    uniqueIndex("uq_cuisines_instance_fold")
      .on(t.nameFold)
      .where(sql`${t.householdId} IS NULL`),
    index("idx_cuisines_created_at").on(t.createdAt),
  ]
);
