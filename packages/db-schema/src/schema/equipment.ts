import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { mutableRowColumns, versionColumn } from "./shared";

/**
 * Equipment: one row per kitchen tool or utensil, known by many Equipment
 * Aliases. A recipe equipment line points at an alias, and the alias points
 * here, so every spelling or translation of one tool resolves to one Equipment.
 *
 * `ownerId` is whoever's action minted the Equipment, null for the seed.
 * `icon` is the Equipment Icon a person set for the tool (a 64px transparent
 * WebP under the uploads directory, named for its content), or the shipped
 * icon's name.
 */
export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    icon: text("icon"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uqidx_equipment_name_lower").on(sql`lower(${t.name})`),
    index("idx_equipment_created_at").on(t.createdAt),
  ]
);

/**
 * Equipment Aliases: every spelling, variant, and translation of an Equipment
 * item. The fold is the normalized folding of the text and is unique, so one
 * spelling means one Equipment item instance-wide.
 */
export const equipmentAliases = pgTable(
  "equipment_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    text: text("text").notNull(),
    fold: text("fold").notNull(),
    equipmentId: uuid("equipment_id")
      .notNull()
      .references(() => equipment.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    seeded: boolean("seeded").notNull().default(false),
    ...mutableRowColumns,
  },
  (t) => [
    uniqueIndex("uqidx_equipment_aliases_fold").on(t.fold),
    index("idx_equipment_aliases_equipment_id").on(t.equipmentId),
  ]
);
