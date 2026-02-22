import { index, pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const households = pgTable(
  "households",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    adminUserId: text("admin_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinCode: text("join_code"),
    joinCodeExpiresAt: timestamp("join_code_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_households_name").on(t.name),
    index("idx_households_created_at").on(t.createdAt),
    index("idx_households_admin_user_id").on(t.adminUserId),
    unique("uq_households_join_code").on(t.joinCode),
  ]
);
