import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";
import { stores } from "./stores";

/**
 * An Aisle: a heading within a Store, named and ordered by the household,
 * standing for where in that shop things are found. Aisles belong to their
 * Store, so a household shares them through the store it already shares, and
 * they go with it. A Store's aisle names are unique regardless of case, so
 * "Zuivel" and "zuivel" cannot both exist.
 */
export const aisles = pgTable(
  "aisles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_aisles_store_id").on(t.storeId),
    uniqueIndex("uqidx_aisles_store_name_lower").on(t.storeId, sql`lower(${t.name})`),
  ]
);

/**
 * An Aisle Link: where a Store has learned a grocery name is found. Keyed by
 * store and normalized name exactly as a Product Link is (ADR-0031), so filing
 * one "melk" files every "melk" at that Store and the memory outlives the list
 * line that prompted it. Deleting the aisle deletes the link, which is what
 * unfiling is; deleting the store takes everything with it.
 */
export const aisleLinks = pgTable(
  "aisle_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    normalizedName: text("normalized_name").notNull(),
    aisleId: uuid("aisle_id")
      .notNull()
      .references(() => aisles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    index("idx_aisle_links_store_id").on(t.storeId),
    index("idx_aisle_links_aisle_id").on(t.aisleId),
    unique("uq_aisle_links_store_name").on(t.storeId, t.normalizedName),
  ]
);
