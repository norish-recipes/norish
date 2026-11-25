import { index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { households } from "./households";
import { recipes } from "./recipes";
import { householdIdFilledByTrigger, mutableRowColumns } from "./shared";

/**
 * A Cookbook: a titled set of recipes, and nothing else.
 *
 * It belongs to its Owner like a recipe, in their household, under the Permission
 * Policy rather than a rule of its own (ADR-0027, ADR-0041).
 *
 * The cover is derived at read time from the members' own images unless
 * someone has uploaded an `image` for the cookbook itself, which then shows
 * instead. There is deliberately no description.
 */
export const cookbooks = pgTable(
  "cookbooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    householdId: householdIdFilledByTrigger(() => households.id),
    title: text("title").notNull(),
    image: text("image"),
    ...mutableRowColumns,
  },
  (t) => [
    index("idx_cookbooks_user_id").on(t.userId),
    index("idx_cookbooks_household_id").on(t.householdId),
    index("idx_cookbooks_title").on(t.title),
    index("idx_cookbooks_created_at_desc").on(t.createdAt.desc()),
  ]
);

/**
 * Membership: which recipes are in which cookbook.
 *
 * Unique on the pair, so filing the same recipe twice changes nothing, and
 * cascading from both sides — deleting a recipe takes it out of every
 * cookbook it was in and leaves those cookbooks standing, deleting a
 * cookbook leaves every recipe it held untouched.
 *
 * There is no order column: a Cookbook is a set, not a sequence. The row's
 * own `createdAt` costs nothing and leaves "recently added" available as a
 * future sort.
 */
export const cookbookRecipes = pgTable(
  "cookbook_recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cookbookId: uuid("cookbook_id")
      .notNull()
      .references(() => cookbooks.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_cookbook_recipes_cookbook_recipe").on(t.cookbookId, t.recipeId),
    index("idx_cookbook_recipes_cookbook_id").on(t.cookbookId),
    index("idx_cookbook_recipes_recipe_id").on(t.recipeId),
  ]
);
