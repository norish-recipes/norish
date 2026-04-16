"use client";

import { useTRPC } from "@/app/providers/trpc-provider";

import type { RecipeIdResult } from "@norish/shared-react/hooks";
import { createUseRecipeId } from "@norish/shared-react/hooks/recipes/recipe";

const useSharedRecipeId = createUseRecipeId({ useTRPC });

export type { RecipeIdResult };

export const useRecipeId = useSharedRecipeId;
