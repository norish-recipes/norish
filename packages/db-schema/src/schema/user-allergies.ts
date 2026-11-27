import { index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { versionColumn } from "./shared";

/** An account's allergies, plain names matched on the folded name against any recipe's Tags. */
export const userAllergies = pgTable(
  "user_allergies",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.name], name: "pk_user_allergies" }),
    index("idx_user_allergies_user_id").on(t.userId),
  ]
);
