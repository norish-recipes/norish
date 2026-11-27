import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";
import { versionColumn } from "./shared";

/**
 * Categories (ADR-0040, ADR-0043): the four built-ins are the instance entries
 * (`household_id` null); a household's own are unique on `entryFold(name)` within it.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameFold: text("name_fold").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uq_categories_household_fold")
      .on(t.householdId, t.nameFold)
      .where(sql`${t.householdId} IS NOT NULL`),
    uniqueIndex("uq_categories_instance_fold")
      .on(t.nameFold)
      .where(sql`${t.householdId} IS NULL`),
  ]
);
