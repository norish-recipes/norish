import crypto from "crypto";

import {
  timestamp,
  pgTable,
  text,
  uniqueIndex,
  boolean,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// User table with encrypted PII fields
export const users = pgTable(
  "user",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),

    // Encrypted fields (actual data stored encrypted)
    // BetterAuth uses "email", "name", "image" - we map to these but store encrypted values
    email: text("email").notNull(),
    name: text("name").notNull(),
    image: text("image"),

    // Deterministic HMAC index for email lookup (only email needs lookup capability)
    emailHmac: text("emailHmac"),

    emailVerified: boolean("emailVerified").default(false).notNull(),

    // Norish-specific fields
    isServerOwner: boolean("isServerOwner").notNull().default(false),
    isServerAdmin: boolean("isServerAdmin").notNull().default(false),

    // BetterAuth timestamps
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("user_email_hmac_idx").on(t.emailHmac),
    // Ensure only one server owner can exist (prevents race condition during first user registration)
    uniqueIndex("user_single_server_owner_idx").on(t.isServerOwner).where("isServerOwner = true"),
  ]
);

// OAuth accounts linked to users (BetterAuth native column names)
export const accounts = pgTable(
  "account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Provider info
    providerId: text("providerId").notNull(),
    accountId: text("accountId").notNull(),

    // OAuth tokens (not encrypted - short-lived, minimal security benefit)
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),

    // Token expiration
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { mode: "date" }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
      mode: "date",
    }),

    scope: text("scope"),
    password: text("password"), // For credential auth (not used currently)

    // BetterAuth timestamps
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index("account_user_id_idx").on(t.userId),
    uniqueIndex("account_provider_unique").on(t.providerId, t.accountId),
  ]
);

// Sessions table (BetterAuth native column names)
export const sessions = pgTable(
  "session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),

    // Session metadata
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),

    // BetterAuth timestamps
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
);

// Verification tokens (email verification, password reset, etc.)
export const verification = pgTable(
  "verification",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)]
);

// API Keys for external access (mobile shortcuts, integrations)
export const apiKeys = pgTable(
  "apikey",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Key info
    name: text("name"),
    start: text("start"), // First few chars for identification
    prefix: text("prefix"),
    key: text("key").notNull(), // Hashed key

    // Usage limits
    refillInterval: integer("refillInterval"),
    refillAmount: integer("refillAmount"),
    lastRefillAt: timestamp("lastRefillAt", { mode: "date" }),
    remaining: integer("remaining"),

    // Rate limiting
    enabled: boolean("enabled").default(true),
    rateLimitEnabled: boolean("rateLimitEnabled").default(true),
    rateLimitTimeWindow: integer("rateLimitTimeWindow").default(60000), // 1 minute in ms
    rateLimitMax: integer("rateLimitMax").default(100), // 100 requests per minute
    requestCount: integer("requestCount").default(0),
    lastRequest: timestamp("lastRequest", { mode: "date" }),

    // Expiration
    expiresAt: timestamp("expiresAt", { mode: "date" }),

    // Metadata
    permissions: text("permissions"),
    metadata: text("metadata"),

    // Timestamps
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [index("apikey_key_idx").on(t.key), index("apikey_user_id_idx").on(t.userId)]
);

// Relations
export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  apiKeys: many(apiKeys),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const apiKeyRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));
