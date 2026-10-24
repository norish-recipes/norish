import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { mutableRowColumns, versionColumn } from "./shared";

/**
 * What an Open Food Facts taxonomy entry says about its food's nutrition
 * (ADR-0039): the codes it is known by in the open food datasets, in the
 * order Ingredient Nutrition tries them, and its piece weight and density.
 */
export interface NutritionCodes {
  /** CIQUAL codes: the entry's own code first, then its proxy. */
  ciqual: string[];
  /** USDA codes, in the order tried: `ndb:11282` (SR Legacy) or `fdc:170000`. */
  usda: string[];
  /** Other CIQUAL-keyed codes (secondary codes, Agribalyse's), tried after USDA. */
  ciqualOther: string[];
  /** `average_weight_per_unit`: grams per piece. */
  pieceWeight: number | null;
  /** `density_g_per_ml`. */
  density: number | null;
}

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
 * `flagReason` says why a Flagged Ingredient is one, in the catalogue's own
 * words (`FLAG_REASONS`), and is cleared with the flag. `keptDistinct` says a
 * person marked it a food of its own: Norish never merges it later, not even
 * when its rules for reading a name change.
 *
 * `offId` is the Open Food Facts taxonomy entry a seeded Ingredient stands
 * for ("en:onion"), which is how a refresh of the seed finds it again
 * (ADR-0038). `nutritionCodes` is what that entry says about its nutrition,
 * as the seed last read it, so a code fixed upstream arrives overnight
 * (ADR-0039); null for an Ingredient no entry gives any.
 *
 * `icon` is the Ingredient Icon a person set for the food, uploaded or
 * generated: the file name of a 128px transparent WebP under the uploads
 * directory, named for its content. Null shows the icon Norish ships for
 * `offId`, else the nearest Parent Ingredient's.
 *
 * `nameSettled` says the name is its Plain Name for good: AI gave it, a person named the food, or
 * a person undid AI's rename; AI gives no other, and the recheck never renames it from the words.
 * `nameChosen` says a person named it, which, like `keptDistinct` and `parentChosen`, keeps AI off.
 *
 * `unusedSince` is when the nightly sweep first found nothing naming an own Ingredient; only
 * the sweep sets and clears it, and deletes the food after 90 days.
 */
export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    keptDistinct: boolean("kept_distinct").notNull().default(false),
    parentId: uuid("parent_id").references((): AnyPgColumn => ingredients.id, {
      onDelete: "set null",
    }),
    parentChosen: boolean("parent_chosen").notNull().default(false),
    offId: text("off_id"),
    nutritionCodes: jsonb("nutrition_codes").$type<NutritionCodes>(),
    icon: text("icon"),
    nameSettled: boolean("name_settled").notNull().default(false),
    nameChosen: boolean("name_chosen").notNull().default(false),
    unusedSince: timestamp("unused_since", { withTimezone: true }),
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
 * Merging Ingredients moves aliases; what points at an alias moves only when
 * the alias is removed, to another spelling of the same food.
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
