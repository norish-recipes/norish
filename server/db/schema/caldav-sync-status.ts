import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

export const caldavItemTypes = ["recipe", "note"] as const;
export const caldavSyncStatuses = ["pending", "synced", "failed", "removed"] as const;
export const caldavItemTypeEnum = pgEnum("caldav_item_type", [...caldavItemTypes]);
export const caldavSyncStatusEnum = pgEnum("caldav_sync_status_enum", [...caldavSyncStatuses]);

export const caldavSyncStatus = pgTable(
  "caldav_sync_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull(),
    itemType: caldavItemTypeEnum("item_type").notNull(),
    plannedItemId: uuid("planned_item_id"),
    eventTitle: text("event_title").notNull(),
    syncStatus: caldavSyncStatusEnum("sync_status").notNull().default("pending"),
    caldavEventUid: text("caldav_event_uid"),
    retryCount: integer("retry_count").notNull().default(0),
    errorMessage: varchar("error_message", { length: 500 }),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_caldav_sync_user_item").on(t.userId, t.itemId),
    index("idx_caldav_sync_user_status").on(t.userId, t.syncStatus),
    index("idx_caldav_sync_status_retry").on(t.syncStatus, t.retryCount, t.lastSyncAt),
  ]
);
