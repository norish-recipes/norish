"use client";

import type { RecipesMutationsResult } from "@norish/shared-react/recipes";
import {
  useRecipeMutationErrorToast,
  useRecipesMutations as useSharedRecipesMutations,
} from "@norish/shared-react/recipes";

export function useRecipesMutations(): RecipesMutationsResult {
  return useSharedRecipesMutations(useRecipeMutationErrorToast());
}
