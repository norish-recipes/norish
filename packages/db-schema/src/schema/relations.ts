import { relations } from "drizzle-orm";

import { accounts, apiKeys, sessions, users } from "./auth";
import { groceries } from "./groceries";
import { householdUsers } from "./household-users";
import { households } from "./households";
import { ingredients } from "./ingredients";
import { recipeImages } from "./recipe-images";
import { recipeIngredients } from "./recipe-ingredients";
import { recipeRatings } from "./recipe-ratings";
import { recipeShares } from "./recipe-shares";
import { recipeTags } from "./recipe-tags";
import { recipeVideos } from "./recipe-videos";
import { recipes } from "./recipes";
import { serverConfig } from "./server-config";
import { stepImages } from "./step-images";
import { steps } from "./steps";
import { ingredientStorePreferences, stores } from "./stores";
import { tags } from "./tags";
import { userAllergies } from "./user-allergies";

export const recipesRelations = relations(recipes, ({ many }) => ({
  ingredients: many(recipeIngredients),
  recipeTags: many(recipeTags),
  steps: many(steps),
  ratings: many(recipeRatings),
  images: many(recipeImages),
  videos: many(recipeVideos),
  shares: many(recipeShares),
}));

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  apiKeys: many(apiKeys),
  recipeShares: many(recipeShares),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const apiKeyRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.referenceId],
    references: [users.id],
  }),
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

export const recipeImagesRelations = relations(recipeImages, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeImages.recipeId],
    references: [recipes.id],
  }),
}));

export const recipeVideosRelations = relations(recipeVideos, ({ one }) => ({
  recipe: one(recipes, {
    fields: [recipeVideos.recipeId],
    references: [recipes.id],
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
  store: one(stores, {
    fields: [groceries.storeId],
    references: [stores.id],
  }),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  user: one(users, {
    fields: [stores.userId],
    references: [users.id],
  }),
  groceries: many(groceries),
  ingredientPreferences: many(ingredientStorePreferences),
}));

export const ingredientStorePreferencesRelations = relations(
  ingredientStorePreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [ingredientStorePreferences.userId],
      references: [users.id],
    }),
    store: one(stores, {
      fields: [ingredientStorePreferences.storeId],
      references: [stores.id],
    }),
  })
);

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

export const recipeSharesRelations = relations(recipeShares, ({ one }) => ({
  user: one(users, {
    fields: [recipeShares.userId],
    references: [users.id],
  }),
  recipe: one(recipes, {
    fields: [recipeShares.recipeId],
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
