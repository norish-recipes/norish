import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";

/**
 * The deployment's Cuisine vocabulary.
 *
 * Structurally identical to `tags` and governed the opposite way: Tags are an
 * open folksonomy anyone may extend, Cuisines are curated by an administrator
 * — or by AI only under an explicitly permissive strategy (ADR-0012).
 *
 * Rows rather than an enum, because an enum cannot be extended from a settings
 * form, which is the whole point of administrator ownership.
 */
export const cuisines = pgTable(
  "cuisines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uqidx_cuisines_name_lower").on(sql`lower(${t.name})`),
    index("idx_cuisines_created_at").on(t.createdAt),
  ]
);
