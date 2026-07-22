"use client";

import type { RecipeIdResult } from "@norish/shared-react/hooks";
import { createUseRecipeId } from "@norish/shared-react/hooks/recipes/recipe";

const useSharedRecipeId = createUseRecipeId();

export type { RecipeIdResult };

export const useRecipeId = useSharedRecipeId;
