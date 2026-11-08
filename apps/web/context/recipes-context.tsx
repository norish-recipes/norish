"use client";

import { createContext, use, useMemo } from "react";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useFavoritesMutation, useFavoritesQuery } from "@/hooks/favorites";
import { useLibraryRecipesQuery } from "@/hooks/library";
import { useRecipesMutations } from "@/hooks/recipes";
import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { useActiveAllergies, useUserAllergiesQuery } from "@/hooks/user";

import type {
  FullRecipeInsertDTO,
  FullRecipeUpdateDTO,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";
import { createRecipesContext } from "@norish/shared-react/contexts";
import { usePlatform } from "@norish/shared-react/platform";

type Ctx = {
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  pendingRecipeIds: Set<string>;
  favoriteIds: string[];
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;
  allergies: string[];
  hasAppliedFilters: boolean;
  clearFilters: () => void;
  filterKey: string;
  loadMore: () => void;
  importRecipe: (url: string) => void;
  importRecipeWithAI: (url: string) => void;
  createRecipe: (input: FullRecipeInsertDTO) => void;
  updateRecipe: (id: string, input: FullRecipeUpdateDTO) => void;
  deleteRecipes: (recipes: Array<{ id: string; version: number }>) => void;
  invalidate: () => void;
  openRecipe: (id: string) => void;
};

const sharedRecipesContext = createRecipesContext({
  useRecipesFiltersContext,
  // The Library is one interleaved list, so the context's list comes from the
  // union rather than from `recipes.list` beside it (ADR-0026). `total` there
  // counts both kinds.
  useRecipesQuery: useLibraryRecipesQuery,
  useRecipesMutations,
  useFavoritesQuery,
  useFavoritesMutation,
  useUserAllergiesQuery,
  useRecipesSubscription: sharedDashboardRecipeHooks.useRecipesSubscription,
  useRatingsSubscription: sharedDashboardRecipeHooks.useRatingsSubscription,
  useToastAdapter: () => usePlatform().toast,
  useNavigationAdapter: () => usePlatform().navigation,
});

const RecipesContext = createContext<Ctx | null>(null);

export function RecipesContextProvider({ children }: { children: React.ReactNode }) {
  return (
    <sharedRecipesContext.RecipesProvider>
      <RecipesContextAdapter>{children}</RecipesContextAdapter>
    </sharedRecipesContext.RecipesProvider>
  );
}

function RecipesContextAdapter({ children }: { children: React.ReactNode }) {
  const base = sharedRecipesContext.useRecipesContext();
  const { allergies } = useActiveAllergies();

  // Favourites are narrowed by the Library query itself now, so there is no
  // client-side slice left here — one that recomputed `total` from the current
  // page would make paging lie.
  const value = useMemo<Ctx>(
    () => ({
      ...base,
      allergies,
    }),
    [base, allergies]
  );

  return <RecipesContext value={value}>{children}</RecipesContext>;
}

export function useRecipesContext() {
  const ctx = use(RecipesContext);

  if (!ctx) throw new Error("useRecipesContext must be used within RecipesContextProvider");

  return ctx;
}
