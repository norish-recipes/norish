import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";

/**
 * Ingredient Names: every ingredient name a recipe line has ever used,
 * de-duplicated case-insensitively. A recipe line shows this name verbatim.
 *
 * `normalizedName` is the one grocery folding (`normalizeGroceryName`),
 * written in JavaScript so it agrees with the browser. It is what the Pantry
 * matches on (ADR-0032): two names that fold alike are the same thing at home,
 * though they stay separate rows here. A null fold is a row written before the
 * folding existed, which the startup backfill fills in.
 */
export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uqidx_ingredients_name_lower").on(sql`lower(${t.name})`),
    index("idx_ingredients_created_at").on(t.createdAt),
    index("idx_ingredients_normalized_name").on(t.normalizedName),
  ]
);
