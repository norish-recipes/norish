import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  unique,
  pgEnum,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

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
    image: text("image"),
    url: text("url"),
    servings: integer("servings").notNull().default(1),
    prepMinutes: integer("prep_minutes"),
    cookMinutes: integer("cook_minutes"),
    totalMinutes: integer("total_minutes"),
    systemUsed: measurementSystemEnum("system_used").notNull().default("metric"),
    calories: integer("calories"),
    fat: numeric("fat", { precision: 6, scale: 2 }),
    carbs: numeric("carbs", { precision: 6, scale: 2 }),
    protein: numeric("protein", { precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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
