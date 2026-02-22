import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { tags } from "./tags";

export const userAllergies = pgTable(
  "user_allergies",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.userId, t.tagId],
      name: "pk_user_allergies",
    }),
    index("idx_user_allergies_user_id").on(t.userId),
    index("idx_user_allergies_tag_id").on(t.tagId),
  ]
);
