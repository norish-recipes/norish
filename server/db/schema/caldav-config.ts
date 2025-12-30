import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const userCaldavConfig = pgTable("user_caldav_config", {
  userId: text("user_id")
    .primaryKey()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  serverUrlEnc: text("server_url_enc").notNull(),
  calendarUrlEnc: text("calendar_url_enc"), // Optional: specific calendar URL selected by user
  usernameEnc: text("username_enc").notNull(),
  passwordEnc: text("password_enc").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  breakfastTime: text("breakfast_time").notNull().default("08:00-09:00"),
  lunchTime: text("lunch_time").notNull().default("12:00-13:00"),
  dinnerTime: text("dinner_time").notNull().default("18:00-19:00"),
  snackTime: text("snack_time").notNull().default("15:00-15:30"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
