import { index, integer, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";
import { tags } from "./tags";

export const recipeTags = pgTable(
  "recipe_tags",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "no action" }),
    order: integer("order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.recipeId, t.tagId], name: "pk_recipe_tags" }),
    index("idx_recipe_tags_recipe_id").on(t.recipeId),
    index("idx_recipe_tags_tag_id").on(t.tagId),
  ]
);
