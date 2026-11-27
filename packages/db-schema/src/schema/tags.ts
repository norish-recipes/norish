import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";
import { versionColumn } from "./shared";

/** A household's Tags (ADR-0043), unique on `entryFold(name)` within the household. */
export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameFold: text("name_fold").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uq_tags_household_fold")
      .on(t.householdId, t.nameFold)
      .where(sql`${t.householdId} IS NOT NULL`),
    uniqueIndex("uq_tags_instance_fold")
      .on(t.nameFold)
      .where(sql`${t.householdId} IS NULL`),
    index("idx_tags_created_at").on(t.createdAt),
  ]
);
