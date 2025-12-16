"use client";

import { createContext, useContext, ReactNode, useMemo, useCallback } from "react";
import { addToast } from "@heroui/react";
import { useRouter } from "next/navigation";

import { RecipeDashboardDTO, FullRecipeInsertDTO, FullRecipeUpdateDTO } from "@/types";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useRecipesQuery, useRecipesMutations, useRecipesSubscription } from "@/hooks/recipes";
import { useFavoritesQuery } from "@/hooks/favorites";
import { useRatingsSubscription } from "@/hooks/ratings";

type Ctx = {
  // Data
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
  hasMore: boolean;
  pendingRecipeIds: Set<string>;

  // Actions (all void - fire and forget)
  loadMore: () => void;
  importRecipe: (url: string) => void;
  createRecipe: (input: FullRecipeInsertDTO) => void;
  updateRecipe: (id: string, input: FullRecipeUpdateDTO) => void;
  deleteRecipe: (id: string) => void;

  // Query state
  invalidate: () => void;
};

const RecipesContext = createContext<Ctx | null>(null);

export function RecipesContextProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { filters } = useRecipesFiltersContext();

  // Map filters from context to query format
  const queryFilters = useMemo(
    () => ({
      search: filters.rawInput || undefined,
      tags: filters.searchTags.length > 0 ? filters.searchTags : undefined,
      filterMode: filters.filterMode as "AND" | "OR",
      sortMode: filters.sortMode as "titleAsc" | "titleDesc" | "dateAsc" | "dateDesc",
      minRating: filters.minRating ?? undefined,
    }),
    [filters]
  );

  const {
    recipes: allRecipes,
    total: serverTotal,
    isLoading,
    hasMore,
    loadMore,
    pendingRecipeIds,
    invalidate,
  } = useRecipesQuery(queryFilters);

  const { favoriteIds, isLoading: isFavoritesLoading } = useFavoritesQuery();

  const { recipes, total } = useMemo(() => {
    if (!filters.showFavoritesOnly) {
      return { recipes: allRecipes, total: serverTotal };
    }
    const favoriteSet = new Set(favoriteIds);
    const filtered = allRecipes.filter((r) => favoriteSet.has(r.id));
    return { recipes: filtered, total: filtered.length };
  }, [allRecipes, serverTotal, filters.showFavoritesOnly, favoriteIds]);

  const {
    importRecipe: importRecipeMutation,
    createRecipe: createRecipeMutation,
    updateRecipe: updateRecipeMutation,
    deleteRecipe,
  } = useRecipesMutations();

  // Subscribe to recipe and rating events
  useRecipesSubscription();
  useRatingsSubscription();

  const importRecipe = useCallback(
    (url: string): void => {
      addToast({
        severity: "default",
        title: "Importing recipe...",
        description: "Import in progress, please wait...",
      });

      importRecipeMutation(url);
      router.push("/");
    },
    [importRecipeMutation, router]
  );

  const createRecipe = useCallback(
    (input: FullRecipeInsertDTO): void => {
      createRecipeMutation(input);
      router.push("/");
    },
    [createRecipeMutation, router]
  );

  const updateRecipe = useCallback(
    (id: string, input: FullRecipeUpdateDTO): void => {
      updateRecipeMutation(id, input);
      router.push(`/recipes/${id}`);
    },
    [updateRecipeMutation, router]
  );

  const value = useMemo<Ctx>(
    () => ({
      recipes,
      total,
      isLoading: isLoading || isFavoritesLoading,
      hasMore,
      pendingRecipeIds,
      loadMore,
      importRecipe,
      createRecipe,
      updateRecipe,
      deleteRecipe,
      invalidate,
    }),
    [
      recipes,
      total,
      isLoading,
      isFavoritesLoading,
      hasMore,
      pendingRecipeIds,
      loadMore,
      importRecipe,
      createRecipe,
      updateRecipe,
      deleteRecipe,
      invalidate,
    ]
  );

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}

export function useRecipesContext() {
  const ctx = useContext(RecipesContext);

  if (!ctx) throw new Error("useRecipesContext must be used within RecipesContextProvider");

  return ctx;
}
