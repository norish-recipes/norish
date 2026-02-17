"use client";

import { createContext, useContext, ReactNode, useMemo, useCallback } from "react";
import { addToast } from "@heroui/react";
import { useRouter } from "next/navigation";

import { RecipeDashboardDTO, FullRecipeInsertDTO, FullRecipeUpdateDTO } from "@/types";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useRecipesQuery, useRecipesMutations, useRecipesSubscription } from "@/hooks/recipes";
import { useFavoritesQuery, useFavoritesMutation } from "@/hooks/favorites";
import { useRatingsSubscription } from "@/hooks/ratings";
import { useActiveAllergies } from "@/hooks/user";

type Ctx = {
  // Data
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
  isFetchingMore: boolean;
  hasMore: boolean;
  pendingRecipeIds: Set<string>;
  autoTaggingRecipeIds: Set<string>;

  // Favorites (lifted from useFavoritesQuery to avoid per-card observers)
  favoriteIds: string[];
  isFavorite: (recipeId: string) => boolean;
  toggleFavorite: (recipeId: string) => void;

  // Allergies (lifted from useActiveAllergies to avoid per-card observers)
  allergies: string[];

  // Filters (lifted to avoid RecipeGrid subscribing to filters context directly)
  hasAppliedFilters: boolean;
  clearFilters: () => void;
  filterKey: string; // Stable key for scroll restoration

  // Actions (all void - fire and forget)
  loadMore: () => void;
  importRecipe: (url: string) => void;
  importRecipeWithAI: (url: string) => void;
  createRecipe: (input: FullRecipeInsertDTO) => void;
  updateRecipe: (id: string, input: FullRecipeUpdateDTO) => void;
  deleteRecipe: (id: string) => void;

  // Query state
  invalidate: () => void;
};

const RecipesContext = createContext<Ctx | null>(null);

export function RecipesContextProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { filters, clearFilters } = useRecipesFiltersContext();

  // Map filters from context to query format
  const queryFilters = useMemo(
    () => ({
      search: filters.rawInput || undefined,
      searchFields: filters.searchFields,
      tags: filters.searchTags.length > 0 ? filters.searchTags : undefined,
      categories: filters.categories.length > 0 ? filters.categories : undefined,
      filterMode: filters.filterMode as "AND" | "OR",
      sortMode: filters.sortMode,
      minRating: filters.minRating ?? undefined,
      maxCookingTime: filters.maxCookingTime ?? undefined,
    }),
    [filters]
  );

  // Stable key for scroll restoration - changes when filters change
  const filterKey = useMemo(() => JSON.stringify(queryFilters), [queryFilters]);

  const {
    recipes: allRecipes,
    total: serverTotal,
    isLoading,
    isValidating,
    hasMore,
    loadMore,
    pendingRecipeIds,
    autoTaggingRecipeIds,
    invalidate,
  } = useRecipesQuery(queryFilters);

  // Favorites - single query at context level, exposed to all children
  const { favoriteIds, isFavorite, isLoading: isFavoritesLoading } = useFavoritesQuery();
  const { toggleFavorite } = useFavoritesMutation();

  // Allergies - single query at context level, exposed to all children
  const { allergies } = useActiveAllergies();

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
    importRecipeWithAI: importRecipeWithAIMutation,
    createRecipe: createRecipeMutation,
    updateRecipe: updateRecipeMutation,
    deleteRecipe,
  } = useRecipesMutations();

  // Subscribe to recipe and rating events (uses internal cache helpers)
  useRecipesSubscription();
  useRatingsSubscription();

  const importRecipe = useCallback(
    (url: string): void => {
      addToast({
        severity: "default",
        title: "Importing recipe...",
        description: "Import in progress, please wait...",
        shouldShowTimeoutProgress: true,
        radius: "full",
      });

      importRecipeMutation(url);
      router.push("/");
    },
    [importRecipeMutation, router]
  );

  const importRecipeWithAI = useCallback(
    (url: string): void => {
      addToast({
        severity: "default",
        title: "Importing recipe with AI...",
        description: "Import in progress, please wait...",
        shouldShowTimeoutProgress: true,
        radius: "full",
      });

      importRecipeWithAIMutation(url);
      router.push("/");
    },
    [importRecipeWithAIMutation, router]
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

  // Derived state for empty state check
  const hasAppliedFilters = useMemo(() => {
    const hasSearch = filters.rawInput.trim().length > 0;
    const hasTags = filters.searchTags.length > 0;
    const hasCategories = filters.categories.length > 0;
    const hasCookingTime = filters.maxCookingTime !== null;

    return hasSearch || hasTags || hasCategories || hasCookingTime;
  }, [filters.rawInput, filters.searchTags, filters.categories, filters.maxCookingTime]);

  const value = useMemo<Ctx>(
    () => ({
      recipes,
      total,
      isLoading: isLoading || isFavoritesLoading,
      isFetchingMore: isValidating && !isLoading,
      hasMore,
      pendingRecipeIds,
      autoTaggingRecipeIds,
      favoriteIds,
      isFavorite,
      toggleFavorite,
      allergies,
      hasAppliedFilters,
      clearFilters,
      filterKey,
      loadMore,
      importRecipe,
      importRecipeWithAI,
      createRecipe,
      updateRecipe,
      deleteRecipe,
      invalidate,
    }),
    [
      recipes,
      total,
      isLoading,
      isValidating,
      isFavoritesLoading,
      hasMore,
      pendingRecipeIds,
      autoTaggingRecipeIds,
      favoriteIds,
      isFavorite,
      toggleFavorite,
      allergies,
      hasAppliedFilters,
      clearFilters,
      filterKey,
      loadMore,
      importRecipe,
      importRecipeWithAI,
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
