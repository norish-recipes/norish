import { createContext, useCallback, useContext, useMemo } from "react";

import type { FullRecipeInsertDTO, FullRecipeUpdateDTO } from "@norish/shared/contracts";

import type {
  FavoritesMutationResult,
  FavoritesQueryResult,
  RatingsSubscriptionCallbacks,
  RecipeFilters,
  RecipesMutationsResult,
  RecipesQueryResult,
  RecipesSubscriptionCallbacks,
} from "../../hooks/recipes/dashboard";
import type { RecipeToastAdapter } from "./recipe-toast-adapter";
import {
  hasAppliedRecipeFilters,
  serializeRecipeFilters,
  toRecipesQueryFilters,
} from "./filter-contract";
import {
  createRatingsSubscriptionToasts,
  createRecipeImportToasts,
  createRecipeSubscriptionToasts,
} from "./recipe-toast-adapter";

export type SharedRecipesContextValue = {
  recipes: RecipesQueryResult["recipes"];
  total: number;
  isLoading: boolean;
  isValidating: boolean;
  error: unknown;
  isFetchingMore: boolean;
  hasMore: boolean;
  pendingRecipeIds: Set<string>;
  autoTaggingRecipeIds: Set<string>;
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
  deleteRecipe: (id: string, version: number) => void;
  invalidate: () => void;
  openRecipe: (id: string) => void;
};

type RecipesNavigationAdapter = {
  toHome: () => void;
  toRecipe: (id: string) => void;
};

type RecipesFiltersContextShape = {
  filters: Parameters<typeof toRecipesQueryFilters>[0];
  clearFilters: () => void;
};

type CreateRecipesContextOptions = {
  useRecipesFiltersContext: () => RecipesFiltersContextShape;
  useRecipesQuery: (filters: RecipeFilters) => RecipesQueryResult;
  useRecipesMutations: () => Pick<
    RecipesMutationsResult,
    "importRecipe" | "importRecipeWithAI" | "createRecipe" | "updateRecipe" | "deleteRecipe"
  >;
  useFavoritesQuery: () => Pick<FavoritesQueryResult, "favoriteIds" | "isFavorite" | "isLoading">;
  useFavoritesMutation: () => Pick<FavoritesMutationResult, "toggleFavorite">;
  useUserAllergiesQuery: () => { allergies: string[] };
  useRecipesSubscription: (callbacks?: RecipesSubscriptionCallbacks) => void;
  useRatingsSubscription?: (callbacks?: RatingsSubscriptionCallbacks) => void;
  useToastAdapter: () => RecipeToastAdapter;
  useNavigationAdapter: () => RecipesNavigationAdapter;
  queryDefaults?: Partial<RecipeFilters>;
};

export function createRecipesContext({
  useRecipesFiltersContext,
  useRecipesQuery,
  useRecipesMutations,
  useFavoritesQuery,
  useFavoritesMutation,
  useUserAllergiesQuery,
  useRecipesSubscription,
  useRatingsSubscription,
  useToastAdapter,
  useNavigationAdapter,
  queryDefaults,
}: CreateRecipesContextOptions) {
  const RecipesContext = createContext<SharedRecipesContextValue | null>(null);

  function RecipesProvider({ children }: { children: React.ReactNode }) {
    const { filters, clearFilters } = useRecipesFiltersContext();
    const navigation = useNavigationAdapter();
    const toastAdapter = useToastAdapter();

    const queryFilters = useMemo(
      () => ({ ...toRecipesQueryFilters(filters), ...(queryDefaults ?? {}) }),
      [filters]
    );
    const filterKey = useMemo(() => serializeRecipeFilters(filters), [filters]);

    const {
      recipes,
      total,
      isLoading,
      isValidating,
      error,
      hasMore,
      pendingRecipeIds,
      autoTaggingRecipeIds,
      loadMore,
      invalidate,
    } = useRecipesQuery(queryFilters);

    const {
      importRecipe: importRecipeMutation,
      importRecipeWithAI: importRecipeWithAIMutation,
      createRecipe,
      updateRecipe,
      deleteRecipe,
    } = useRecipesMutations();
    const { favoriteIds, isFavorite, isLoading: isFavoritesLoading } = useFavoritesQuery();
    const { toggleFavorite } = useFavoritesMutation();
    const { allergies } = useUserAllergiesQuery();

    const importToasts = useMemo(() => createRecipeImportToasts(toastAdapter), [toastAdapter]);
    const subscriptionToasts = useMemo(
      () => createRecipeSubscriptionToasts(toastAdapter, { onOpenRecipe: navigation.toRecipe }),
      [navigation.toRecipe, toastAdapter]
    );
    const ratingsToasts = useMemo(
      () => createRatingsSubscriptionToasts(toastAdapter),
      [toastAdapter]
    );

    useRecipesSubscription(subscriptionToasts);
    useRatingsSubscription?.(ratingsToasts);

    const openRecipe = useCallback(
      (id: string) => {
        navigation.toRecipe(id);
      },
      [navigation]
    );

    const importRecipe = useCallback(
      (url: string) => {
        importToasts.showImportRecipePending();
        importRecipeMutation(url);
        navigation.toHome();
      },
      [importRecipeMutation, importToasts, navigation]
    );

    const importRecipeWithAI = useCallback(
      (url: string) => {
        importToasts.showImportRecipeWithAIPending();
        importRecipeWithAIMutation(url);
        navigation.toHome();
      },
      [importRecipeWithAIMutation, importToasts, navigation]
    );

    const wrappedCreateRecipe = useCallback(
      (input: FullRecipeInsertDTO) => {
        createRecipe(input);
        navigation.toHome();
      },
      [createRecipe, navigation]
    );

    const wrappedUpdateRecipe = useCallback(
      (id: string, input: FullRecipeUpdateDTO) => {
        updateRecipe(id, input);
        navigation.toRecipe(id);
      },
      [navigation, updateRecipe]
    );

    const hasAppliedFilters = useMemo(() => hasAppliedRecipeFilters(filters), [filters]);

    const value = useMemo<SharedRecipesContextValue>(
      () => ({
        recipes,
        total,
        isLoading: isLoading || isFavoritesLoading,
        isValidating,
        error,
        favoriteIds,
        isFavorite,
        toggleFavorite,
        allergies,
        isFetchingMore: isValidating && !isLoading,
        hasMore,
        pendingRecipeIds,
        autoTaggingRecipeIds,
        hasAppliedFilters,
        clearFilters,
        filterKey,
        loadMore,
        importRecipe,
        importRecipeWithAI,
        createRecipe: wrappedCreateRecipe,
        updateRecipe: wrappedUpdateRecipe,
        deleteRecipe,
        invalidate,
        openRecipe,
      }),
      [
        recipes,
        total,
        isLoading,
        isFavoritesLoading,
        favoriteIds,
        isFavorite,
        toggleFavorite,
        allergies,
        isValidating,
        error,
        hasMore,
        pendingRecipeIds,
        autoTaggingRecipeIds,
        hasAppliedFilters,
        clearFilters,
        filterKey,
        loadMore,
        importRecipe,
        importRecipeWithAI,
        wrappedCreateRecipe,
        wrappedUpdateRecipe,
        deleteRecipe,
        invalidate,
        openRecipe,
      ]
    );

    return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
  }

  function useRecipesContext() {
    const context = useContext(RecipesContext);

    if (!context) {
      throw new Error("useRecipesContext must be used within RecipesProvider");
    }

    return context;
  }

  return {
    RecipesProvider,
    useRecipesContext,
  };
}
