import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { recipeCategoryEnum } from "./recipe-categories";
import { versionColumn } from "./shared";

export const measurementSystemEnum = pgEnum("measurement_system", ["metric", "us"]);

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    /**
     * @deprecated — the primary image lives in `recipe_images`. Readers
     * resolve gallery-first (`primaryRecipeImage` / the repository's
     * PRIMARY_IMAGE_SQL); writers never store a value here any more (a
     * payload scalar is translated into the gallery, and media-touching
     * writes clear this column). Only untouched legacy rows still carry a
     * value, until a migration retires the column.
     */
    image: text("image"),
    url: text("url"),
    servings: integer("servings").notNull().default(1),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    totalMinutes: integer("total_minutes"),
    notes: text("notes"),
    systemUsed: measurementSystemEnum("system_used").notNull().default("metric"),
    // The system the recipe was written in, recorded when a conversion first
    // writes a copy in the other one; null for a recipe never converted, whose
    // only system is `systemUsed`. A conversion with AI may write over the
    // converted copy, never over this one.
    originalSystem: measurementSystemEnum("original_system"),
    calories: integer("calories"),
    fat: numeric("fat", { precision: 6, scale: 2 }),
    carbs: numeric("carbs", { precision: 6, scale: 2 }),
    protein: numeric("protein", { precision: 6, scale: 2 }),
    // Recipe Provenance. The country is an ISO-3166-1 alpha-2 code — kept
    // authoritative for flags and pickers — beside its written name, which is
    // recipe content: inference writes it in the language of the recipe
    // itself (that language is deliberately not recorded), and a manual pick
    // stores the label the editor saw. The region is free text and the note
    // is written in the recipe's language; none of the three is translated.
    // Rows with a code and no name fall back to endonym rendering.
    originCountry: text("origin_country"),
    originCountryName: text("origin_country_name"),
    originRegion: text("origin_region"),
    provenanceNote: text("provenance_note"),
    // The Dish Colour (ADR-0023): one colour extracted from the recipe's
    // primary image when that image is stored, as a `#rrggbb` hex string.
    // Derived, never supplied — it does not travel in a Recipe Archive, and
    // a recipe with no image simply has none.
    dishColor: text("dish_color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    categories: recipeCategoryEnum("categories").array().notNull().default([]),
    ...versionColumn,
  },
  (t) => [
    index("idx_recipes_user_id").on(t.userId),
    index("idx_recipes_name").on(t.name),
    unique("uq_recipes_url_user").on(t.url, t.userId),
    index("idx_recipes_created_at_desc").on(t.createdAt.desc()),
    index("idx_recipes_total_minutes").on(t.totalMinutes),
    index("idx_recipes_prep_minutes").on(t.prepMinutes),
    index("idx_recipes_cook_minutes").on(t.cookMinutes),
  ]
);
