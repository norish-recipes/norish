"use client";

import { createContext, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRecipesFiltersContext } from "@/context/recipes-filters-context";
import { useFavoritesMutation, useFavoritesQuery } from "@/hooks/favorites";
import { useRecipesMutations, useRecipesQuery } from "@/hooks/recipes";
import { sharedDashboardRecipeHooks } from "@/hooks/recipes/shared-recipe-hooks";
import { useActiveAllergies, useUserAllergiesQuery } from "@/hooks/user";
import { addToast } from "@heroui/react";
import { useTranslations } from "next-intl";

import type {
  FullRecipeInsertDTO,
  FullRecipeUpdateDTO,
  RecipeDashboardDTO,
} from "@norish/shared/contracts";
import { createScopedMessageTranslator } from "@norish/i18n";
import { createRecipesContext } from "@norish/shared-react/contexts";

type Ctx = {
  recipes: RecipeDashboardDTO[];
  total: number;
  isLoading: boolean;
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

const sharedRecipesContext = createRecipesContext({
  useRecipesFiltersContext,
  useRecipesQuery,
  useRecipesMutations,
  useFavoritesQuery,
  useFavoritesMutation,
  useUserAllergiesQuery,
  useRecipesSubscription: sharedDashboardRecipeHooks.useRecipesSubscription,
  useRatingsSubscription: sharedDashboardRecipeHooks.useRatingsSubscription,
  useToastAdapter: () => {
    const tCommon = useTranslations("common");
    const tRecipes = useTranslations("recipes");

    return {
      show: ({ severity, title, description, actionLabel, onActionPress }) =>
        addToast({
          severity,
          title,
          description,
          shouldShowTimeoutProgress: true,
          radius: "full",
          actionLabel,
          onActionPress,
        }),
      translate: createScopedMessageTranslator({
        common: (messageKey) => tCommon(messageKey as Parameters<typeof tCommon>[0]),
        recipes: (messageKey) => tRecipes(messageKey as Parameters<typeof tRecipes>[0]),
      }),
    };
  },
  useNavigationAdapter: () => {
    const router = useRouter();

    return {
      toHome: () => router.push("/"),
      toRecipe: (id: string) => router.push(`/recipes/${id}`),
    };
  },
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
  const { filters } = useRecipesFiltersContext();

  const { allergies } = useActiveAllergies();

  const { recipes, total } = useMemo(() => {
    if (!filters.showFavoritesOnly) {
      return { recipes: base.recipes, total: base.total };
    }

    const favoriteSet = new Set(base.favoriteIds);
    const filtered = base.recipes.filter((recipe) => favoriteSet.has(recipe.id));

    return { recipes: filtered, total: filtered.length };
  }, [base.recipes, base.total, base.favoriteIds, filters.showFavoritesOnly]);

  const value = useMemo<Ctx>(
    () => ({
      ...base,
      recipes,
      total,
      allergies,
    }),
    [base, recipes, total, allergies]
  );

  return <RecipesContext.Provider value={value}>{children}</RecipesContext.Provider>;
}

export function useRecipesContext() {
  const ctx = useContext(RecipesContext);

  if (!ctx) throw new Error("useRecipesContext must be used within RecipesContextProvider");

  return ctx;
}
