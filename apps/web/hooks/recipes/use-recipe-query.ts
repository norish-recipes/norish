"use client";

import type { RecipeQueryResult } from "@norish/shared-react/hooks";

import { sharedRecipeFamilyHooks } from "./shared-recipe-hooks";

export type { RecipeQueryResult };

export const useRecipeQuery = sharedRecipeFamilyHooks.useRecipeQuery;
