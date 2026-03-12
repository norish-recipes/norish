import { date, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const recurringGroceries = pgTable(
  "recurring_groceries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Item details
    name: text("name").notNull(),
    unit: text("unit"),
    amount: numeric("amount", { precision: 10, scale: 3 }),

    // Recurrence pattern
    recurrenceRule: text("recurrence_rule").notNull(), // 'day', 'week', 'month'
    recurrenceInterval: integer("recurrence_interval").notNull().default(1),
    recurrenceWeekday: integer("recurrence_weekday"), // 0-6 (Sunday-Saturday), NULL if not weekly

    // Schedule tracking
    nextPlannedFor: date("next_planned_for").notNull(), // YYYY-MM-DD
    lastCheckedDate: date("last_checked_date"), // YYYY-MM-DD

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recurring_groceries_user_id").on(t.userId),
    index("idx_recurring_groceries_next_date").on(t.nextPlannedFor),
  ]
);
