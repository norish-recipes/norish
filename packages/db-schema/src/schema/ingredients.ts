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

/**
 * Ingredient Suggestions: what AI proposes for an Ingredient, waiting on a
 * person. AI never edits the catalogue itself; a sure answer lands here, and
 * a person confirms it (the edit is made as if they had made it) or
 * dismisses it (the row goes, the food stays as it was). One per Ingredient:
 * asking again replaces it. `kind` is `merge` (the food is `targetId`),
 * `parent` (the food is a kind of `targetId`) or `distinct` (a food of its
 * own, no target). Many foods may name the same target, so one general food
 * can gather many proposed kinds. Either food going away takes the
 * suggestion with it. `englishName` and `considered` are how AI got there,
 * shown beside the proposal. `source` says who proposed it: `ai`, or `words`
 * for a parent the resolver gave a mint from inside the words of its name
 * ("garlic cloves" under garlic), already filed and waiting to be confirmed
 * or dismissed — dismissing one of those takes the parent off again.
 */
export const ingredientSuggestions = pgTable(
  "ingredient_suggestions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ingredientId: uuid("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    targetId: uuid("target_id").references(() => ingredients.id, { onDelete: "cascade" }),
    englishName: text("english_name"),
    considered: jsonb("considered").$type<string[]>().notNull().default([]),
    source: text("source").notNull().default("ai"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uqidx_ingredient_suggestions_ingredient_id").on(t.ingredientId),
    index("idx_ingredient_suggestions_target_id").on(t.targetId),
  ]
);
