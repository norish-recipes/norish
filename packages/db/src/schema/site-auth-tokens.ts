import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { versionColumn } from "./shared";

export const siteAuthTokenTypeEnum = pgEnum("site_auth_token_type", ["header", "cookie"]);

export const siteAuthTokens = pgTable(
  "site_auth_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    name: text("name").notNull(),
    valueEnc: text("value_enc").notNull(),
    type: siteAuthTokenTypeEnum("type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_site_auth_tokens_user_id").on(t.userId),
    index("idx_site_auth_tokens_user_domain").on(t.userId, t.domain),
  ]
);
