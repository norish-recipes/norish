import { index, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { recipes } from "./recipes";

export const recipeVideos = pgTable(
  "recipe_videos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    video: text("video").notNull(),
    thumbnail: text("thumbnail"),
    duration: numeric("duration"),
    order: numeric("order").default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_recipe_videos_recipe_id").on(t.recipeId)]
);
