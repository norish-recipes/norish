import crypto from "crypto";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";

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

    // Extensible user preferences (JSONB)
    preferences: jsonb("preferences").default(sql`'{}'::jsonb`),

    // BetterAuth timestamps
    createdAt: timestamp("createdAt", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updatedAt", { mode: "date" })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("user_email_hmac_idx").on(t.emailHmac),
    uniqueIndex("user_single_server_owner_idx")
      .on(t.id)
      .where(sql`${t.isServerOwner} = true`),
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
    // better-auth 1.5 renamed userId → referenceId; keep DB column as "userId"
    referenceId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    configId: text("configId").notNull().default("default"),

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
  (t) => [index("apikey_key_idx").on(t.key), index("apikey_user_id_idx").on(t.referenceId)]
);
