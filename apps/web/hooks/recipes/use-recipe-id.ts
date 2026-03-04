"use client";

import type { RecipeIdResult } from "@norish/shared-react/hooks";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

export type { RecipeIdResult };

export const useRecipeId = sharedRecipeFamilyHooks.useRecipeId;
