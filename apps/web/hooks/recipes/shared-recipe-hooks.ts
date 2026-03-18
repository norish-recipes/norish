"use client";

import { createRecipeHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/app/providers/trpc-provider";


const sharedRecipeHooks = createRecipeHooks({ useTRPC });

export const sharedDashboardRecipeHooks = sharedRecipeHooks.dashboard;
export const sharedRecipeFamilyHooks = sharedRecipeHooks.recipe;
