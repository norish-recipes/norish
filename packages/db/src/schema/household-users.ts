import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { households } from "./households";
import { users } from "./auth";

export const householdUsers = pgTable(
  "household_users",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.householdId, t.userId],
      name: "pk_household_users",
    }),
    index("idx_household_users_household_id").on(t.householdId),
    index("idx_household_users_user_id").on(t.userId),
  ]
);
