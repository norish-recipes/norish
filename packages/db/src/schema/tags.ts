import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uqidx_tags_name_lower").on(sql`lower(${t.name})`),
    index("idx_tags_created_at").on(t.createdAt),
  ]
);
