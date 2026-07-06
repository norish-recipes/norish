import crypto from "crypto";
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { versionColumn } from "./shared";

export const serverConfig = pgTable(
  "server_config",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull(),
    value: jsonb("value"),
    valueEnc: text("value_enc"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [uniqueIndex("server_config_key_idx").on(t.key)]
);
