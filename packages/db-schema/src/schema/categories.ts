import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";

/**
 * Categories (ADR-0040): the built-ins plus any a household names on its own
 * recipes. Shared rows like `tags`, unique case-insensitively.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [uniqueIndex("uqidx_categories_name_lower").on(sql`lower(${t.name})`)]
);
