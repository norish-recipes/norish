import crypto from "crypto";

import { pgTable, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * API request logs for tRPC procedures.
 * Stores request metadata, timing, and error information.
 */
export const apiLogs = pgTable(
  "api_logs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    procedure: text("procedure").notNull(),
    type: text("type").notNull(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    durationMs: integer("duration_ms"),
    success: text("success").notNull().default("true"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    meta: jsonb("meta"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("api_logs_procedure_idx").on(t.procedure),
    index("api_logs_user_id_idx").on(t.userId),
    index("api_logs_created_at_idx").on(t.createdAt),
    index("api_logs_success_idx").on(t.success),
  ]
);

export type ApiLog = typeof apiLogs.$inferSelect;
export type NewApiLog = typeof apiLogs.$inferInsert;
