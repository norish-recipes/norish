import { relations } from "drizzle-orm";

import { ingredients } from "./ingredients";
import { recipeIngredients } from "./recipe-ingredients";
import { recipeTags } from "./recipe-tags";
import { recipes } from "./recipes";
import { tags } from "./tags";
import { steps } from "./steps";
import { stepImages } from "./step-images";
import { households } from "./households";
import { householdUsers } from "./household-users";
import { users } from "./auth";
import { groceries } from "./groceries";
import { serverConfig } from "./server-config";
import { recipeRatings } from "./recipe-ratings";
import { userAllergies } from "./user-allergies";

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
  recipeTags: many(recipeTags),
  steps: many(steps),
  ratings: many(recipeRatings),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  recipeTags: many(recipeTags),
  userAllergies: many(userAllergies),
}));

export const ingredientsRelations = relations(ingredients, ({ many }) => ({
  recipeIngredients: many(recipeIngredients),
}));

export const recipeTagsRelations = relations(recipeTags, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeTags.recipeId],
    references: [recipes.id],
  }),
  tag: one(tags, {
    fields: [recipeTags.tagId],
    references: [tags.id],
  }),
}));

export const recipeIngredientsRelations = relations(recipeIngredients, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeIngredients.recipeId],
    references: [recipes.id],
  }),
  ingredient: one(ingredients, {
    fields: [recipeIngredients.ingredientId],
    references: [ingredients.id],
  }),
}));

export const stepsRelations = relations(steps, ({ one, many }) => ({
  recipe: one(recipes, {
    fields: [steps.recipeId],
    references: [recipes.id],
  }),
  images: many(stepImages),
}));

export const stepImagesRelations = relations(stepImages, ({ one }) => ({
  step: one(steps, {
    fields: [stepImages.stepId],
    references: [steps.id],
  }),
}));

export const householdsRelations = relations(households, ({ many }) => ({
  users: many(householdUsers),
}));

export const householdUsersRelations = relations(householdUsers, ({ one }) => ({
  household: one(households, {
    fields: [householdUsers.householdId],
    references: [households.id],
  }),
  user: one(users, {
    fields: [householdUsers.userId],
    references: [users.id],
  }),
}));

export const groceriesRelations = relations(groceries, ({ one }) => ({
  user: one(users, {
    fields: [groceries.userId],
    references: [users.id],
  }),
  recipeIngredient: one(recipeIngredients, {
    fields: [groceries.recipeIngredientId],
    references: [recipeIngredients.id],
  }),
}));

export const serverConfigRelations = relations(serverConfig, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [serverConfig.updatedBy],
    references: [users.id],
  }),
}));

export const recipeRatingsRelations = relations(recipeRatings, ({ one }) => ({
  user: one(users, {
    fields: [recipeRatings.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [recipeRatings.recipeId],
    references: [recipes.id],
  }),
}));

export const userAllergiesRelations = relations(userAllergies, ({ one }) => ({
  user: one(users, {
    fields: [userAllergies.userId],
    references: [users.id],
  }),
  tag: one(tags, {
    fields: [userAllergies.tagId],
    references: [tags.id],
  }),
}));
