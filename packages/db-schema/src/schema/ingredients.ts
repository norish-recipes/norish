import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { mutableRowColumns, versionColumn } from "./shared";

/**
 * Ingredients: one row per food, known by many Ingredient Aliases. A recipe
 * line, a Grocery and a Pantry Ingredient point at an alias, and the alias
 * points here (ADR-0037), so two spellings of one food are one Ingredient.
 * Only the ingredient resolver mints rows.
 *
 * `ownerId` is whoever's action minted the Ingredient, null for the seed.
 * `flagged` marks a mint the resolver was not sure about: a Flagged
 * Ingredient is worth a person's look. `parentId` is the Parent Ingredient,
 * the more general food this one is a kind of ("red onion" under "onion"):
 * a child with no Aisle Link of its own is filed in its parent's Aisle, and a
 * child in the Pantry covers a recipe line for its parent. The tree never
 * has a cycle. `parentChosen` says a person set or cleared the parent: the
 * catalogue seed places only Ingredients whose parent nobody chose.
 *
 * `offId` is the Open Food Facts taxonomy entry a seeded Ingredient stands
 * for ("en:onion"), which is how a refresh of the seed finds it again
 * (ADR-0038).
 */
export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    flagged: boolean("flagged").notNull().default(false),
    parentId: uuid("parent_id").references((): AnyPgColumn => ingredients.id, {
      onDelete: "set null",
    }),
    parentChosen: boolean("parent_chosen").notNull().default(false),
    offId: text("off_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uqidx_ingredients_name_lower").on(sql`lower(${t.name})`),
    index("idx_ingredients_created_at").on(t.createdAt),
    index("idx_ingredients_parent_id").on(t.parentId),
    uniqueIndex("uqidx_ingredients_off_id").on(t.offId),
  ]
);

/**
 * Ingredient Aliases: every spelling, plural, preparation-bearing variant and
 * translation of an Ingredient ever seen. The fold is the one grocery folding
 * of the text and is unique, so one spelling means one food instance-wide.
 * Merging Ingredients moves aliases; nothing that points at an alias moves.
 *
 * `ownerId` is whoever added the alias, null for the seed; `seeded` marks an
 * alias the catalogue seed wrote, which a refresh of the seed may rewrite.
 */
export const ingredientAliases = pgTable(
  "ingredient_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    text: text("text").notNull(),
    fold: text("fold").notNull(),
    locale: text("locale"),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    seeded: boolean("seeded").notNull().default(false),
    ...mutableRowColumns,
  },
  (t) => [
    uniqueIndex("uqidx_ingredient_aliases_fold").on(t.fold),
    index("idx_ingredient_aliases_ingredient_id").on(t.ingredientId),
  ]
);
