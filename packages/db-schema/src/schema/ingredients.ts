import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";

export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uqidx_ingredients_name_lower").on(sql`lower(${t.name})`),
    index("idx_ingredients_created_at").on(t.createdAt),
  ]
);
