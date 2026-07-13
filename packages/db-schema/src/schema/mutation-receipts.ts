import crypto from "node:crypto";
import { index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";

export const mutationReceiptStatus = pgEnum("mutation_receipt_status", ["processing", "completed"]);

/** Server-side idempotency receipts for authenticated mutation deliveries. */
export const mutationReceipts = pgTable(
  "mutation_receipts",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    principalId: text("principal_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    operationId: text("operation_id").notNull(),
    procedurePath: text("procedure_path").notNull(),
    requestFingerprint: text("request_fingerprint").notNull(),
    status: mutationReceiptStatus("status").notNull().default("processing"),
    processingLeaseUntil: timestamp("processing_lease_until", { withTimezone: true }),
    responseEncrypted: text("response_encrypted"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("mutation_receipt_principal_operation_idx").on(
      table.principalId,
      table.operationId
    ),
    index("mutation_receipt_expiry_idx").on(table.expiresAt),
    index("mutation_receipt_status_lease_idx").on(table.status, table.processingLeaseUntil),
  ]
);

export type MutationReceipt = typeof mutationReceipts.$inferSelect;
export type NewMutationReceipt = typeof mutationReceipts.$inferInsert;
