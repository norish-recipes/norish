import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { versionColumn } from "./shared";

/**
 * Ingredient Names: every ingredient name a recipe line has ever used,
 * de-duplicated case-insensitively. A recipe line shows this name verbatim.
 *
 * A name can also carry an Ingredient Illustration, set only by an
 * administrator (ADR-0037). The picture belongs to the name it was drawn for
 * and to nothing else: a line shows the picture of the row it points at.
 *
 * `normalizedName` is the one grocery folding (`normalizeGroceryName`), written
 * in JavaScript so it agrees with the browser. The fold is what the Pantry
 * matches on (ADR-0036), and what a grocery row's free text is matched against
 * to find the picture to show beside it. A null `normalizedName` is a row
 * written before the folding existed, which the startup backfill fills in.
 */
export const ingredients = pgTable(
  "ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name"),
    /** A versioned, immutable path (`/ingredient-images/<id>-<stamp>.webp`), or null. */
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [
    uniqueIndex("uqidx_ingredients_name_lower").on(sql`lower(${t.name})`),
    index("idx_ingredients_created_at").on(t.createdAt),
    index("idx_ingredients_normalized_name").on(t.normalizedName),
  ]
);
