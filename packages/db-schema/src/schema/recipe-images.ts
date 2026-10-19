import { boolean, index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";
import { versionColumn } from "./shared";

export const recipeImages = pgTable(
  "recipe_images",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    image: text("image").notNull(),
    order: numeric("order").default("0"),
    /**
     * A Generated Image: drawn by AI rather than photographed or supplied.
     * The archive export carries it, and the editor reads it to keep the
     * Generated Image out of the Source Image cap (ADR-0040).
     */
    generated: boolean("generated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...versionColumn,
  },
  (t) => [index("idx_recipe_images_recipe_id").on(t.recipeId)]
);
