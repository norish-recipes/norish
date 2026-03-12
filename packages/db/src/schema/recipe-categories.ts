import { pgEnum } from "drizzle-orm/pg-core";

export const recipeCategoryEnum = pgEnum("recipe_category", [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
]);
