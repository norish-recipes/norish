import type { ReactNode } from "react";
import { createContext, use, useCallback, useMemo, useState } from "react";

import type {
  CreateRecipeShareInputDto,
  FullRecipeDTO,
  MeasurementSystem,
  RecipeIngredientsDto,
  RecipeShareCreatedDto,
  RecipeShareSummaryDto,
  UpdateRecipeShareInputDto,
} from "@norish/shared/contracts";

import type { RecipeEnrichmentResult } from "../recipes/recipe";
import { shouldPreserveOptimisticUpdate } from "../optimistic-updates";

// --- Types ---

export type RecipeDetailContextValue = {
  recipe: FullRecipeDTO | null;
  isLoading: boolean;
  /** A saved copy is shown while the server's current one is on its way. */
  isFetching: boolean;
  error: Error | null;
  isNotFound: boolean;
  shares: RecipeShareSummaryDto[];
  isLoadingShares: boolean;
  shareError: Error | null;
  refreshShares: () => void;
  createShare: (
    expiresIn?: CreateRecipeShareInputDto["expiresIn"]
  ) => Promise<RecipeShareCreatedDto | null>;
  updateShare: (input: UpdateRecipeShareInputDto) => void;
  revokeShare: (id: string, version: number) => void;
  reactivateShare: (id: string, version: number) => void;
  deleteShare: (id: string, version: number) => void;
  isCreatingShare: boolean;
  isUpdatingShare: boolean;
  isRevokingShare: boolean;
  isReactivatingShare: boolean;
  isDeletingShare: boolean;
  convertingTo: MeasurementSystem | null;
  adjustedIngredients: RecipeIngredientsDto[];
  currentServings: number;
  setIngredientAmounts: (servings: number) => void;
  /** Convert to `target`; with AI, the copy in it is written again even where one exists. */
  startConversion: (target: MeasurementSystem, withAI?: boolean) => void;
  reset: () => void;
  /** Recipe Enrichment: one lifecycle state per kind, and one way to request a run. */
  enrichment: RecipeEnrichmentResult;
  // Allergies list
  allergies: string[];
  allergySet: Set<string>;
  // Rating
  userRating: number | null;
  rateRecipe: (rating: number | null) => void;
  // Favorite
  liked: boolean;
  toggleLiked: () => void;
};

export type RecipeDetailAdapters = {
  useRecipeQuery: (recipeId: string) => {
    recipe: FullRecipeDTO | null;
    isLoading: boolean;
    isFetching: boolean;
    error: unknown;
    invalidate: () => void;
  };
  useRecipeSubscription: (recipeId: string) => void;
  useRecipeSharesQuery?: (recipeId: string) => {
    shares: RecipeShareSummaryDto[];
    isLoading: boolean;
    error: unknown;
    invalidate: () => void;
  };
  useRecipeShareSubscription?: (recipeId: string | null) => void;
  useRecipeShareMutations?: (recipeId: string | null) => {
    createShare: (
      expiresIn?: CreateRecipeShareInputDto["expiresIn"]
    ) => Promise<RecipeShareCreatedDto | null>;
    updateShare: (input: UpdateRecipeShareInputDto) => void;
    revokeShare: (id: string, version: number) => void;
    reactivateShare: (id: string, version: number) => void;
    deleteShare: (id: string, version: number) => void;
    isCreating: boolean;
    isUpdating: boolean;
    isRevoking: boolean;
    isReactivating: boolean;
    isDeleting: boolean;
  };
  useRecipeEnrichment: (recipeId: string) => RecipeEnrichmentResult;
  useActiveAllergies: () => { allergies: string[]; allergySet: Set<string> };
  useConvertMutation: (recipeId: string) => {
    convertMeasurements: (
      targetSystem: MeasurementSystem,
      version: number,
      withAI?: boolean,
      options?: { onError?: (error: unknown) => void }
    ) => void;
  };
  useRatingQuery: (recipeId: string) => { userRating: number | null };
  useRatingsMutation: () => {
    rateRecipe: (recipeId: string, rating: number | null) => void;
  };
  useFavoriteIds: () => string[] | undefined;
  useFavoritesMutation: () => { toggleFavorite: (recipeId: string) => void };
  isNotFoundError: (error: unknown) => boolean;
};

type RecipeSharesQueryAdapterResult =
  NonNullable<RecipeDetailAdapters["useRecipeSharesQuery"]> extends (
    ...args: never[]
  ) => infer TResult
    ? TResult
    : never;

type RecipeShareMutationsAdapterResult =
  NonNullable<RecipeDetailAdapters["useRecipeShareMutations"]> extends (
    ...args: never[]
  ) => infer TResult
    ? TResult
    : never;

const EMPTY_RECIPE_SHARES: RecipeShareSummaryDto[] = [];

function noop() {}

async function noopAsync<T>(): Promise<T | null> {
  return null;
}

function defaultRecipeSharesQuery(): RecipeSharesQueryAdapterResult {
  return {
    shares: EMPTY_RECIPE_SHARES,
    isLoading: false,
    error: null,
    invalidate: noop,
  };
}

function defaultRecipeShareSubscription() {}

function defaultRecipeShareMutations(): RecipeShareMutationsAdapterResult {
  return {
    createShare: noopAsync,
    updateShare: noop,
    revokeShare: noop,
    reactivateShare: noop,
    deleteShare: noop,
    isCreating: false,
    isUpdating: false,
    isRevoking: false,
    isReactivating: false,
    isDeleting: false,
  };
}

// --- Factory ---

/**
 * The ingredients for the servings a reader picked: each amount scaled from
 * the recipe's own servings, and the recipe's lines as they are when nothing
 * was picked or the pick is the recipe's own.
 */
function scaleIngredients(
  ingredients: RecipeIngredientsDto[],
  recipeServings: number | undefined,
  servings: number | null
): RecipeIngredientsDto[] {
  if (servings === null || !recipeServings || servings === recipeServings) return ingredients;

  return ingredients.map((ing) => {
    if (ing.amount == null) return ing;

    const amountNum = Number(ing.amount);

    if (isNaN(amountNum) || amountNum <= 0) return ing;

    return { ...ing, amount: Math.round((amountNum / recipeServings) * servings * 10000) / 10000 };
  });
}

export function createRecipeDetailContext(adapters: RecipeDetailAdapters) {
  const RecipeContext = createContext<RecipeDetailContextValue | null>(null);
  const useRecipeSharesQuery = adapters.useRecipeSharesQuery ?? defaultRecipeSharesQuery;
  const useRecipeShareSubscription =
    adapters.useRecipeShareSubscription ?? defaultRecipeShareSubscription;
  const useRecipeShareMutations = adapters.useRecipeShareMutations ?? defaultRecipeShareMutations;

  type ProviderProps = {
    recipeId: string;
    children: ReactNode | ((ctx: RecipeDetailContextValue) => ReactNode);
  };

  function RecipeDetailProvider({ recipeId, children }: ProviderProps) {
    "use memo";

    const { recipe, isLoading, isFetching, error } = adapters.useRecipeQuery(recipeId);
    const {
      shares,
      isLoading: isLoadingShares,
      error: shareQueryError,
      invalidate: refreshShares,
    } = useRecipeSharesQuery(recipeId);
    const {
      createShare,
      updateShare,
      revokeShare,
      reactivateShare,
      deleteShare,
      isCreating: isCreatingShare,
      isUpdating: isUpdatingShare,
      isRevoking: isRevokingShare,
      isReactivating: isReactivatingShare,
      isDeleting: isDeletingShare,
    } = useRecipeShareMutations(recipeId);
    // The servings a reader picked, for the recipe they picked them on: another
    // recipe starts from its own.
    const [pickedServings, setPickedServings] = useState<{
      recipeId: string;
      value: number;
    } | null>(null);
    const _servings =
      recipe && pickedServings?.recipeId === recipe.id ? pickedServings.value : null;
    const [conversion, setConversion] = useState<{
      target: MeasurementSystem;
      withAI: boolean;
      version: number;
    } | null>(null);

    // A conversion is over once the recipe shows its target system; one with
    // AI writes the copy already showing again, so it waits for the recipe to
    // change.
    if (
      recipe &&
      conversion &&
      recipe.systemUsed === conversion.target &&
      (!conversion.withAI || recipe.version !== conversion.version)
    ) {
      setConversion(null);
    }

    const convertingTo = conversion?.target ?? null;
    const adjustedIngredients = scaleIngredients(
      recipe?.recipeIngredients ?? [],
      recipe?.servings,
      _servings
    );

    // Subscribe to real-time updates
    adapters.useRecipeSubscription(recipeId);
    useRecipeShareSubscription(recipeId);

    // One hook for every enrichment kind: status, busy state, and requests.
    const enrichment = adapters.useRecipeEnrichment(recipeId);

    // Get allergies
    const { allergies, allergySet } = adapters.useActiveAllergies();

    // Mutation for converting measurements
    const { convertMeasurements } = adapters.useConvertMutation(recipeId);

    // --- Ratings ---
    const { userRating } = adapters.useRatingQuery(recipeId);
    const { rateRecipe: rateRecipeRaw } = adapters.useRatingsMutation();
    const rateRecipe = useCallback(
      (rating: number | null) => rateRecipeRaw(recipeId, rating),
      [recipeId, rateRecipeRaw]
    );

    // --- Favorites ---
    const favoriteIds = adapters.useFavoriteIds();
    const { toggleFavorite: toggleFavoriteRaw } = adapters.useFavoritesMutation();
    const liked = useMemo(() => favoriteIds?.includes(recipeId) ?? false, [favoriteIds, recipeId]);
    const toggleLiked = useCallback(
      () => toggleFavoriteRaw(recipeId),
      [recipeId, toggleFavoriteRaw]
    );

    // Check if error is a 404
    const isNotFound = adapters.isNotFoundError(error);

    const reset = useCallback(() => {
      setConversion(null);
      setPickedServings(null);
    }, []);

    const startConversion = useCallback(
      (target: MeasurementSystem, withAI = false) => {
        if (!recipe) {
          return;
        }

        setConversion({ target, withAI, version: recipe.version });

        convertMeasurements(target, recipe.version, withAI, {
          onError: (error) => {
            if (!shouldPreserveOptimisticUpdate(error)) reset();
          },
        });
      },
      [convertMeasurements, recipe, reset]
    );

    const recipeIdShown = recipe?.id;
    const setIngredientAmounts = useCallback(
      (servings: number) => {
        if (!recipeIdShown || servings == null) return;

        setPickedServings({ recipeId: recipeIdShown, value: servings });
      },
      [recipeIdShown]
    );

    const value = useMemo<RecipeDetailContextValue>(
      () => ({
        recipe,
        isLoading,
        isFetching,
        error: error instanceof Error ? error : error ? new Error(String(error)) : null,
        isNotFound,
        shares,
        isLoadingShares,
        shareError:
          shareQueryError instanceof Error
            ? shareQueryError
            : shareQueryError
              ? new Error(String(shareQueryError))
              : null,
        refreshShares,
        createShare,
        updateShare,
        revokeShare,
        reactivateShare,
        deleteShare,
        isCreatingShare,
        isUpdatingShare,
        isRevokingShare,
        isReactivatingShare,
        isDeletingShare,
        convertingTo,
        adjustedIngredients,
        currentServings: _servings ?? recipe?.servings ?? 1,
        setIngredientAmounts,
        startConversion,
        reset,
        enrichment,
        allergies,
        allergySet,
        userRating,
        rateRecipe,
        liked,
        toggleLiked,
      }),
      [
        recipe,
        isLoading,
        isFetching,
        error,
        isNotFound,
        shares,
        isLoadingShares,
        shareQueryError,
        refreshShares,
        createShare,
        updateShare,
        revokeShare,
        reactivateShare,
        deleteShare,
        isCreatingShare,
        isUpdatingShare,
        isRevokingShare,
        isReactivatingShare,
        isDeletingShare,
        convertingTo,
        adjustedIngredients,
        _servings,
        setIngredientAmounts,
        startConversion,
        reset,
        enrichment,
        allergies,
        allergySet,
        userRating,
        rateRecipe,
        liked,
        toggleLiked,
      ]
    );

    return (
      <RecipeContext value={value}>
        {typeof children === "function" ? children(value) : children}
      </RecipeContext>
    );
  }

  function useRecipeContext() {
    "use memo";

    const ctx = use(RecipeContext);

    if (!ctx) throw new Error("useRecipeContext must be used within RecipeDetailProvider");

    return ctx;
  }

  function useRecipeContextRequired() {
    "use memo";

    const ctx = useRecipeContext();

    if (!ctx.recipe) throw new Error("Recipe not loaded");

    return ctx as typeof ctx & { recipe: NonNullable<typeof ctx.recipe> };
  }

  return {
    RecipeDetailProvider,
    useRecipeContext,
    useRecipeContextRequired,
  };
}
