"use client";


import type { RecipeIdResult } from "@norish/shared-react/hooks";

import { createUseRecipeId } from "@norish/shared-react/hooks/recipes/recipe";

import { useTRPC } from "@/app/providers/trpc-provider";

const useSharedRecipeId = createUseRecipeId({ useTRPC });

export type { RecipeIdResult };

export const useRecipeId = useSharedRecipeId;
